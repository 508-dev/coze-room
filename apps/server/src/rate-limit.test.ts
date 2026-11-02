import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("limits each key independently and reports the retry delay", () => {
    const limiter = new RateLimiter(2, 10_000);

    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 1_000).allowed).toBe(true);
    expect(limiter.check("b", 1_000).allowed).toBe(true);
    expect(limiter.check("a", 2_000)).toEqual({ allowed: false, retryAfterSeconds: 8 });
  });

  it("starts a fresh window after the old one expires", () => {
    const limiter = new RateLimiter(1, 10_000);

    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 9_999).allowed).toBe(false);
    expect(limiter.check("a", 10_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
