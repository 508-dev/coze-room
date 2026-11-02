export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** A small in-memory fixed-window limiter, scoped separately to each endpoint. */
export class RateLimiter {
  private attempts = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    this.prune(now);
    const current = this.attempts.get(key);
    if (!current || now - current.windowStart >= this.windowMs) {
      this.attempts.set(key, { windowStart: now, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count < this.limit) {
      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.windowStart + this.windowMs - now) / 1000)),
    };
  }

  private prune(now: number): void {
    for (const [key, attempt] of this.attempts) {
      if (now - attempt.windowStart >= this.windowMs) this.attempts.delete(key);
    }
  }
}
