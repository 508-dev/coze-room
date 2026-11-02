import { describe, expect, it } from "vitest";
import { normalizePrivateCode } from "./private-rooms";

describe("normalizePrivateCode", () => {
  it.each([
    ["amber-apple-arch", "amber-apple-arch"],
    ["  AMBER APPLE ARCH  ", "amber-apple-arch"],
    ["Amber - Apple---Arch", "amber-apple-arch"],
    ["amber\t apple\n arch", "amber-apple-arch"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizePrivateCode(input)).toBe(expected);
  });
});
