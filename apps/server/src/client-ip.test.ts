import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("uses the right-most proxy hop when spoofed entries precede it", () => {
    const request = new Request("http://dormouse.test/rooms/private", {
      headers: {
        "x-forwarded-for": "198.51.100.8, 203.0.113.9, 192.0.2.44",
      },
    });

    expect(clientIp(request, "10.0.0.2", true)).toBe("192.0.2.44");
  });

  it("ignores forwarded headers unless the single trusted proxy is enabled", () => {
    const request = new Request("http://dormouse.test", {
      headers: { "x-forwarded-for": "192.0.2.44" },
    });

    expect(clientIp(request, "10.0.0.2", false)).toBe("10.0.0.2");
  });

  it("falls back to the direct peer when the trusted header is absent", () => {
    expect(clientIp(new Request("http://dormouse.test"), "10.0.0.2", true)).toBe("10.0.0.2");
  });
});
