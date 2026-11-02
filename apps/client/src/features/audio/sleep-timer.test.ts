import { describe, expect, it, vi } from "vitest";
import { SleepTimer, WIND_DOWN_SECONDS } from "./sleep-timer";

function fixture() {
  const gain = {
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  const completion = {
    onended: null as (() => void) | null,
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };
  const finished = vi.fn();
  const timer = new SleepTimer(
    { currentTime: 10, createOscillator: () => completion } as unknown as AudioContext,
    { gain } as unknown as GainNode,
    finished,
  );
  return { completion, gain, finished, timer };
}

describe("audio sleep timer", () => {
  it("ramps and fires completion on the audio clock", () => {
    const { completion, gain, finished, timer } = fixture();
    timer.set(15);
    const end = 10 + 15 * 60;
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 10);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, end - WIND_DOWN_SECONDS);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledExactlyOnceWith(0, end);
    expect(completion.start).toHaveBeenCalledExactlyOnceWith(10);
    expect(completion.stop).toHaveBeenCalledExactlyOnceWith(end);
    expect(finished).not.toHaveBeenCalled();

    completion.onended?.();
    expect(finished).toHaveBeenCalledOnce();
    expect(completion.disconnect).toHaveBeenCalledOnce();
  });

  it("cancels the audio-clock alarm and restores full gain when switched off", () => {
    const { completion, gain, finished, timer } = fixture();
    timer.set(30);
    timer.set(0);
    expect(completion.onended).toBeNull();
    expect(completion.stop).toHaveBeenCalledTimes(2);
    expect(finished).not.toHaveBeenCalled();
    expect(gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
  });
});
