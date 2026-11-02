import { afterEach, describe, expect, it, vi } from "vitest";
import { attachPlayback, clockOffset, mediaUrl, playbackMode, seekSeconds } from "./media-playback";

afterEach(() => vi.useRealTimers());

describe("media sync", () => {
  it("estimates clock offset using the round-trip midpoint, including skewed clocks", () => {
    const offset = clockOffset(10_000, 2_200, 2_000);
    expect(offset).toBe(7_900);
    expect(seekSeconds({ itemId: "one", startedAt: 5_000 }, 60, 2_200, offset)).toBe(5.1);
    expect(clockOffset(1_000, 10_000)).toBe(-9_000);
  });
  it("clamps before start, near end, and empty media", () => {
    expect(seekSeconds({ itemId: "one", startedAt: 5_000 }, 60, 0, 0)).toBe(0);
    expect(seekSeconds({ itemId: "one", startedAt: 0 }, 60, 100_000, 0)).toBe(59.95);
    expect(seekSeconds({ itemId: null, startedAt: 0 }, 60, 100_000, 0)).toBe(0);
  });
  it("uses only configured mirror filenames, and no URL when unconfigured", () => {
    expect(mediaUrl("", "one", "gif")).toBeNull();
    expect(mediaUrl("https://media.example/", "one", "mp4")).toBe("https://media.example/one.mp4");
    expect(mediaUrl("/__media", "../source", "m4a")).toBeNull();
  });
});

describe("drift-off rendition lifecycle", () => {
  it("preserves local volume and mute across renditions without silent titles muting the next film", () => {
    const settings = { volume: 0.4, muted: false };
    const element = () =>
      Object.assign(new EventTarget(), {
        readyState: 0,
        currentTime: 0,
        volume: 1,
        muted: false,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        load: vi.fn(),
        removeAttribute: vi.fn(),
      });
    const video = element();
    const instance = attachPlayback(
      video as unknown as HTMLMediaElement,
      () => 1,
      vi.fn(),
      settings,
    );
    expect(video.volume).toBe(0.4);
    video.volume = 0.15;
    video.muted = true;
    video.dispatchEvent(new Event("volumechange"));
    instance.destroy();
    const audio = element();
    const second = attachPlayback(audio as unknown as HTMLMediaElement, () => 1, vi.fn(), settings);
    expect(audio.volume).toBe(0.15);
    expect(audio.muted).toBe(true);
    second.destroy();
    settings.muted = false;
    const silent = element();
    const third = attachPlayback(
      silent as unknown as HTMLMediaElement,
      () => 1,
      vi.fn(),
      settings,
      true,
    );
    expect(silent.muted).toBe(true);
    silent.dispatchEvent(new Event("volumechange"));
    expect(settings.muted).toBe(false);
    third.destroy();
  });
  it("makes one transition to audio, does not switch repeatedly, and wakes to video only if open", () => {
    const states = [
      [false, true],
      [true, true],
      [true, true],
      [true, false],
      [false, false],
      [false, true],
    ] as const;
    const modes = states.map(([drifting, open]) => playbackMode(true, drifting, open));
    expect(modes).toEqual(["video", "audio", "audio", "audio", "off", "video"]);
    expect(playbackMode(false, true, true)).toBe("off");
  });
  it("seeks on metadata and periodically without reloading or restarting on every sample", async () => {
    vi.useFakeTimers();
    const element = Object.assign(new EventTarget(), {
      readyState: 0,
      currentTime: 0,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
    });
    let target = 1;
    const blocked = vi.fn();
    const instance = attachPlayback(element as unknown as HTMLMediaElement, () => target, blocked);
    expect(element.play).not.toHaveBeenCalled();
    element.readyState = 1;
    element.dispatchEvent(new Event("loadedmetadata"));
    await Promise.resolve();
    expect(element.currentTime).toBe(1);
    target = 70;
    vi.advanceTimersByTime(15_000);
    expect(element.currentTime).toBe(70);
    expect(element.play).toHaveBeenCalledTimes(1);
    expect(element.load).not.toHaveBeenCalled();
    instance.destroy();
    expect(element.pause).toHaveBeenCalledOnce();
    expect(element.removeAttribute).toHaveBeenCalledWith("src");
    expect(element.load).toHaveBeenCalledOnce();
    target = 99;
    vi.advanceTimersByTime(30_000);
    expect(element.currentTime).toBe(70);
  });
  it("offers a gesture retry after blocked autoplay and ignores settled promises after teardown", async () => {
    const element = Object.assign(new EventTarget(), {
      readyState: 1,
      currentTime: 0,
      play: vi.fn().mockRejectedValue(new Error("autoplay")),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
    });
    const blocked = vi.fn();
    const instance = attachPlayback(element as unknown as HTMLMediaElement, () => 5, blocked);
    await Promise.resolve();
    expect(blocked).toHaveBeenCalledWith(true);
    blocked.mockClear();
    instance.start();
    instance.destroy();
    await Promise.resolve();
    expect(blocked).not.toHaveBeenCalled();
  });
});
