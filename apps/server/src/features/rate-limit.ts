/**
 * A per-key token bucket. `capacity` is the burst allowed before the refill
 * rate kicks in; `refillMs` is the time it takes to earn one token back.
 * State lives inside an instance so each room gets its own limiter.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; last: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillMs: number,
  ) {}

  /** True when the key may act now; false when it must wait. */
  allow(key: string, now: number): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, last: now };
      this.buckets.set(key, bucket);
    }
    // A backwards clock would otherwise mint tokens; refuse instead.
    if (now < bucket.last) return false;
    const refills = Math.floor((now - bucket.last) / this.refillMs);
    if (refills > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refills);
      // Advance only whole intervals so a partial period still counts down.
      bucket.last += refills * this.refillMs;
    }
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }
}
