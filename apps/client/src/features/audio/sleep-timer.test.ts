import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SleepTimer, WIND_DOWN_SECONDS } from "./sleep-timer";

function fixture() {
  const gain = {
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  const finished = vi.fn();
  const timer = new SleepTimer({ currentTime: 10 }, { gain } as unknown as GainNode, finished);
  return { gain, finished, timer };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("audio sleep timer", () => {
  it("holds full volume until the final minute, then ramps gently to silence", () => {
    const { gain, finished, timer } = fixture();
    timer.set(15);
    const end = 10 + 15 * 60;
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 10);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, end - WIND_DOWN_SECONDS);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledExactlyOnceWith(0, end);
    vi.advanceTimersByTime(15 * 60 * 1000 - 1);
    expect(finished).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(finished).toHaveBeenCalledOnce();
  });

  it("cancels a pending timer and restores full gain when switched off", () => {
    const { gain, finished, timer } = fixture();
    timer.set(30);
    timer.set(0);
    vi.runAllTimers();
    expect(finished).not.toHaveBeenCalled();
    expect(gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
  });
});
