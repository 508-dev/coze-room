import { describe, expect, it } from "vitest";
import { isValidCoreClientMessage } from "./client-message";

const look = { tone: 0, head: 0, top: 0, accessory: 0 };

describe("core client message validation", () => {
  it.each([
    { t: "join", name: "guest", look },
    { t: "join", name: "guest", look: { tone: 7, head: 7, top: 7, accessory: 7 } },
    { t: "takeSeat", seatId: "hammock" },
    { t: "stand" },
    { t: "awake" },
    { t: "pong" },
  ])("accepts a valid core message: %j", (message) => {
    expect(isValidCoreClientMessage(message)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { t: 123 },
    { t: "join", name: 123, look },
    { t: "join", look },
    { t: "join", name: "guest" },
    { t: "join", name: "guest", look: null },
    { t: "join", name: "guest", look: [] },
    { t: "takeSeat" },
    { t: "takeSeat", seatId: 123 },
  ])("rejects malformed core data: %j", (message) => {
    expect(isValidCoreClientMessage(message)).toBe(false);
  });

  for (const field of ["tone", "head", "top", "accessory"]) {
    it.each([undefined, null, "1", -1, 8, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      `rejects invalid ${field} index: %s`,
      (value) => {
        expect(
          isValidCoreClientMessage({ t: "join", name: "guest", look: { ...look, [field]: value } }),
        ).toBe(false);
      },
    );
  }

  it("leaves feature-specific payload validation to the owning feature", () => {
    expect(isValidCoreClientMessage({ t: "futureFeature", payload: {} })).toBe(true);
  });
});
