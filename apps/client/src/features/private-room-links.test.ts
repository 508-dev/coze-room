import { describe, expect, it, vi } from "vitest";
import { watchPrivateCodeHash } from "./private-room-links";

function makeTarget(initialHash = "") {
  let listener: (() => void) | undefined;
  return {
    location: { hash: initialHash },
    addEventListener: vi.fn((_type: "hashchange", callback: () => void) => {
      listener = callback;
    }),
    removeEventListener: vi.fn(() => {
      listener = undefined;
    }),
    navigate(hash: string) {
      this.location.hash = hash;
      listener?.();
    },
  };
}

describe("watchPrivateCodeHash", () => {
  it("joins initial and later same-tab code links, and ignores unrelated hashes", () => {
    const target = makeTarget("#code=first-room-code");
    const join = vi.fn();
    const stop = watchPrivateCodeHash(target, join);

    expect(join).toHaveBeenCalledExactlyOnceWith("first-room-code");
    target.navigate("#quiet");
    expect(join).toHaveBeenCalledOnce();
    target.navigate("#code=second-room-code");
    expect(join).toHaveBeenCalledTimes(2);
    expect(join).toHaveBeenLastCalledWith("second-room-code");

    stop();
    target.navigate("#code=after-cleanup");
    expect(join).toHaveBeenCalledTimes(2);
    expect(target.removeEventListener).toHaveBeenCalledOnce();
  });
});
