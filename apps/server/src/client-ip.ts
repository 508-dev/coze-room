export function clientIp(
  request: Request,
  directAddress: string | undefined,
  trustProxy = process.env.TRUST_PROXY === "1",
): string {
  if (trustProxy) {
    // Coolify's Traefik is the single trusted proxy and appends the peer IP at
    // the right of X-Forwarded-For; every entry to its left is client-controlled.
    // The app port must only be reachable through that proxy, never directly.
    const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  return directAddress ?? "unknown";
}
