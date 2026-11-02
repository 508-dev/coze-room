/**
 * The single source of truth for the API origin used by every client network
 * call: the WebSocket connection and all REST/fetch requests.
 *
 * Resolution order:
 *   1. `VITE_API_BASE_URL`, when set to a non-empty value, is the explicit
 *      override. Development sets it to the server's assigned API port; a
 *      deployment could use it to point at a separate origin.
 *   2. The page's own origin in production. The server serves the client, the
 *      `/rooms` REST endpoints, and the `/ws` WebSocket on one origin, so a
 *      same-origin relative call is correct and survives any proxy/CDN.
 *   3. The local dev default otherwise, so `bun run dev` keeps working even
 *      when `VITE_API_BASE_URL` is not exported.
 */

/** Today's dev fallback, matching the server's `API_PORT` default. */
export const DEV_API_BASE_URL = "http://127.0.0.1:8820";

export interface ApiBaseInput {
  /** `import.meta.env.VITE_API_BASE_URL` (may be undefined or empty). */
  readonly explicit?: string | undefined;
  /** `import.meta.env.DEV`. */
  readonly dev: boolean;
  /** `window.location.origin`. */
  readonly origin: string;
}

/** Resolve the HTTP(S) API base for REST calls. */
export function resolveApiBase(input: ApiBaseInput): string {
  if (input.explicit && input.explicit.trim() !== "") return input.explicit;
  if (input.dev) return DEV_API_BASE_URL;
  return input.origin;
}

/** Derive the WebSocket base for the same API endpoint (http→ws, https→wss). */
export function resolveSocketBase(base: string): string {
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/** The live API base, wired to the real Vite/browser environment. */
export function apiBaseUrl(): string {
  return resolveApiBase({
    explicit: import.meta.env.VITE_API_BASE_URL,
    dev: import.meta.env.DEV,
    // Lazily read the window origin: only production (non-dev, no override)
    // needs it, and the Vitest node environment has no `window` even though
    // `DEV` is true there.
    get origin() {
      return window.location.origin;
    },
  });
}

/** A `URL` for a REST path against the live API base. */
export function apiUrl(path: string): URL {
  return new URL(path, apiBaseUrl());
}

/** A `URL` for a WebSocket path against the live API base. */
export function socketUrl(path: string): URL {
  return new URL(path, resolveSocketBase(apiBaseUrl()));
}
