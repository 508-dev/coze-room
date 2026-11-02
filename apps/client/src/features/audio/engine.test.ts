import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCachedAudio, RoomAudioEngine } from "./engine";

function audioParam(value = 1) {
  return {
    value,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}

function fakeContext() {
  const gains: {
    gain: ReturnType<typeof audioParam>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const mediaSources: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const oscillators: {
    onended: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const sources: {
    buffer: AudioBuffer | null;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: "running",
    currentTime: 5,
    destination: {},
    resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => {
      const oscillator = { onended: null, start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = { gain: audioParam(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain);
      return gain;
    }),
    createMediaElementSource: vi.fn(() => {
      const source = { connect: vi.fn(), disconnect: vi.fn() };
      mediaSources.push(source);
      return source;
    }),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 165 }) as AudioBuffer),
  };
  return { context: context as unknown as AudioContext, gains, mediaSources, oscillators, sources };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ambient Web Audio playback", () => {
  it("uses a looping AudioBufferSourceNode and crossfades environment changes", async () => {
    const { context, sources } = fakeContext();
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );
    const engine = new RoomAudioEngine(
      () => context,
      () => "probably",
    );

    expect(await engine.play("rain", { ogg: "/rain.ogg", m4a: "/rain.m4a" })).toBe(true);
    expect(sources[0]).toMatchObject({ loop: true, loopStart: 0, loopEnd: 165 });
    expect(sources[0]?.start).toHaveBeenCalledExactlyOnceWith(5);

    expect(
      await engine.play("clear-night", {
        ogg: "/clear-night.ogg",
        m4a: "/clear-night.m4a",
      }),
    ).toBe(true);
    expect(sources[0]?.stop).toHaveBeenCalledExactlyOnceWith(6.55);
    expect(sources[1]?.loop).toBe(true);
  });

  it("routes the TV through the same audio-clock sleep wind-down", async () => {
    const { context, gains, mediaSources, oscillators } = fakeContext();
    const engine = new RoomAudioEngine(
      () => context,
      () => "probably",
    );
    await engine.connectMediaElement("tv", {} as HTMLMediaElement);
    expect(mediaSources[0]?.connect).toHaveBeenCalledExactlyOnceWith(gains[2]);

    engine.setSleepTimer(15, vi.fn());
    expect(gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledExactlyOnceWith(0, 905);
    oscillators[0]?.onended?.();
    // Timer expiry holds the combined TV/ambient gain at zero.
    expect(gains[0]?.gain.setValueAtTime).toHaveBeenCalledTimes(3);
  });

  it("keeps audio stopped after the sleep timer until an explicit restart", async () => {
    const { context, oscillators } = fakeContext();
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );
    const engine = new RoomAudioEngine(
      () => context,
      () => "probably",
    );
    await engine.play("rain", { ogg: "/rain.ogg", m4a: "/rain.m4a" });
    const finished = vi.fn();
    engine.setSleepTimer(15, finished);
    oscillators[0]?.onended?.();
    expect(finished).toHaveBeenCalledOnce();
    expect(
      await engine.play("clear-night", {
        ogg: "/clear-night.ogg",
        m4a: "/clear-night.m4a",
      }),
    ).toBe(false);

    engine.clearSleepExpiration();
    expect(
      await engine.play("clear-night", {
        ogg: "/clear-night.ogg",
        m4a: "/clear-night.m4a",
      }),
    ).toBe(true);
  });
});

describe("persistent audio downloads", () => {
  it("serves the second visit from Cache Storage without refetching", async () => {
    let stored: Response | undefined;
    const cache = {
      match: vi.fn(async () => stored),
      put: vi.fn(async (_url: string, response: Response) => {
        stored = response;
      }),
    };
    vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
    const fetcher = vi.fn(async () => new Response(new Uint8Array([4, 5, 6]), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    expect(new Uint8Array(await fetchCachedAudio("/rain.ogg"))).toEqual(new Uint8Array([4, 5, 6]));
    expect(new Uint8Array(await fetchCachedAudio("/rain.ogg"))).toEqual(new Uint8Array([4, 5, 6]));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("uses fetched audio even when Cache Storage writes are denied", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match: vi.fn(async () => undefined),
        put: vi.fn(async () => {
          throw new Error("quota denied");
        }),
      })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([7, 8, 9]), { status: 200 })),
    );
    expect(new Uint8Array(await fetchCachedAudio("/rain.ogg"))).toEqual(new Uint8Array([7, 8, 9]));
  });
});
