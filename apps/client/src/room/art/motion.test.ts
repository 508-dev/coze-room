import { describe, expect, it, vi } from "vitest";
import {
  breathingOffset,
  motionPhase,
  observeReducedMotion,
  occupantHash,
  occupantLook,
} from "./motion";

describe("procedural occupant motion", () => {
  it("keeps colour identity deterministic across seats, and covers all looks", () => {
    const looks = ["cream", "ember", "moss", "teal"];
    expect(occupantLook("ada", looks)).toBe(occupantLook("ada", [...looks]));
    expect(
      new Set(Array.from({ length: 100 }, (_, i) => occupantLook(`guest-${i}`, looks))).size,
    ).toBe(4);
    expect(occupantLook("ada", [])).toBeUndefined();
    expect(occupantHash("ada")).toBeGreaterThanOrEqual(0);
  });

  it("has a two-second awake cycle and a four-second sleeping cycle", () => {
    for (let now = 0; now < 4000; now += 100) {
      expect(breathingOffset(now, "ada", false)).toBe(breathingOffset(now + 2000, "ada", false));
      expect(breathingOffset(now, "ada", true)).toBe(breathingOffset(now + 4000, "ada", true));
      expect([0, 1]).toContain(breathingOffset(now, "ada", true));
      expect(breathingOffset(now, "ada", true, true)).toBe(0);
    }
    expect(
      new Set(Array.from({ length: 20 }, (_, i) => breathingOffset(i * 200, "ada", true))).size,
    ).toBe(2);
    expect(motionPhase(10, "ada", 4)).not.toBe(motionPhase(10, "bea", 4));
    expect(motionPhase(-100000, "ada", 4)).toBeGreaterThanOrEqual(0);
  });

  it("observes live reduced-motion changes and cleans up", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const media = { matches: true, addEventListener, removeEventListener };
    vi.stubGlobal("window", { matchMedia: () => media });
    const changed = vi.fn();
    const off = observeReducedMotion(changed);
    expect(changed).toHaveBeenLastCalledWith(true);
    media.matches = false;
    addEventListener.mock.calls[0]?.[1]();
    expect(changed).toHaveBeenLastCalledWith(false);
    off();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    vi.unstubAllGlobals();
  });
});
