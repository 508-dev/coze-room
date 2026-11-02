import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ATTRACT_FPS, ATTRACT_RENDER_RESOLUTION, AttractPlayback } from "./playback";

function makeScene(init: () => Promise<void> = async () => {}) {
  return {
    init: vi.fn(init),
    drawRoom: vi.fn(),
    syncOccupants: vi.fn(),
    setPaused: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeVisibility() {
  let listener: (() => void) | undefined;
  return {
    hidden: false,
    addEventListener: vi.fn((_type: "visibilitychange", value: () => void) => {
      listener = value;
    }),
    removeEventListener: vi.fn(),
    change(hidden: boolean) {
      this.hidden = hidden;
      listener?.();
    },
  };
}

const host = {} as HTMLElement;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AttractPlayback lifecycle", () => {
  it("feeds the real scene a low-resolution, low-FPS local room", async () => {
    const scene = makeScene();
    const playback = new AttractPlayback(scene, makeVisibility());
    await playback.init(host);

    expect(scene.init).toHaveBeenCalledExactlyOnceWith(host, expect.anything(), {
      resolution: ATTRACT_RENDER_RESOLUTION,
      maxFPS: ATTRACT_FPS,
    });
    expect(scene.drawRoom).toHaveBeenCalledOnce();
    expect(scene.syncOccupants).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(4_000);
    expect(scene.syncOccupants.mock.lastCall?.[0]).toHaveLength(2);
    playback.destroy();
    expect(scene.destroy).toHaveBeenCalledOnce();
  });

  it("freezes the script and renderer while hidden, then resumes without skipping", async () => {
    const scene = makeScene();
    const visibility = makeVisibility();
    const playback = new AttractPlayback(scene, visibility);
    await playback.init(host);
    vi.advanceTimersByTime(4_000);
    const callsBeforeHidden = scene.syncOccupants.mock.calls.length;

    visibility.change(true);
    expect(scene.setPaused).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(20_000);
    expect(scene.syncOccupants).toHaveBeenCalledTimes(callsBeforeHidden);

    visibility.change(false);
    expect(scene.setPaused).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(1_000);
    expect(scene.syncOccupants.mock.lastCall?.[0]).toHaveLength(2);
    playback.destroy();
  });

  it("destroys a scene whose asynchronous init finishes after unmount", async () => {
    let finishInit: () => void = () => {};
    const scene = makeScene(
      () =>
        new Promise<void>((resolve) => {
          finishInit = resolve;
        }),
    );
    const visibility = makeVisibility();
    const playback = new AttractPlayback(scene, visibility);
    const initializing = playback.init(host);

    playback.destroy();
    expect(scene.destroy).not.toHaveBeenCalled();
    finishInit();
    await initializing;
    expect(scene.destroy).toHaveBeenCalledOnce();
    expect(visibility.addEventListener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
