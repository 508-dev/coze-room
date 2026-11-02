import { describe, expect, it } from "vitest";
import { DEV_API_BASE_URL, resolveApiBase, resolveSocketBase } from "./api-base";

describe("resolveApiBase", () => {
  it("prefers an explicit VITE_API_BASE_URL override in every mode", () => {
    const explicit = "https://api.example.test";
    expect(resolveApiBase({ explicit, dev: true, origin: "http://127.0.0.1:8830" })).toBe(explicit);
    expect(resolveApiBase({ explicit, dev: false, origin: "https://dormouse.508.dev" })).toBe(
      explicit,
    );
  });

  it("keeps the local dev default in development", () => {
    expect(resolveApiBase({ dev: true, origin: "http://127.0.0.1:8830" })).toBe(DEV_API_BASE_URL);
  });

  it("uses the page's own origin in production", () => {
    expect(resolveApiBase({ dev: false, origin: "https://dormouse.508.dev" })).toBe(
      "https://dormouse.508.dev",
    );
  });

  it("treats a blank explicit override as unset", () => {
    expect(resolveApiBase({ explicit: "", dev: false, origin: "https://dormouse.508.dev" })).toBe(
      "https://dormouse.508.dev",
    );
    expect(resolveApiBase({ explicit: "   ", dev: true, origin: "http://127.0.0.1:8830" })).toBe(
      DEV_API_BASE_URL,
    );
  });
});

describe("resolveSocketBase", () => {
  it("derives ws from an http base", () => {
    expect(resolveSocketBase("http://127.0.0.1:8820")).toBe("ws://127.0.0.1:8820/");
  });

  it("derives wss from an https base", () => {
    expect(resolveSocketBase("https://dormouse.508.dev")).toBe("wss://dormouse.508.dev/");
  });

  it("derives wss from an https base with a non-default port", () => {
    expect(resolveSocketBase("https://dormouse.508.dev:8443")).toBe("wss://dormouse.508.dev:8443/");
  });
});
