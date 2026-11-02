import { describe, expect, it } from "vitest";
import { generatePrivateCode, PRIVATE_CODE_WORDS } from "./private-codes";

describe("private room codes", () => {
  it("uses 256 distinct words for 24 bits of entropy", () => {
    expect(PRIVATE_CODE_WORDS).toHaveLength(256);
    expect(new Set(PRIVATE_CODE_WORDS).size).toBe(256);
  });

  it("draws three words from the list", () => {
    expect(generatePrivateCode(() => 0)).toBe("amber-amber-amber");
    expect(generatePrivateCode(() => 255)).toBe("peony-peony-peony");
  });

  it("keeps the production sampler compatible with the list bounds", () => {
    for (let sample = 0; sample < 100; sample += 1) {
      const words = generatePrivateCode().split("-");
      expect(words).toHaveLength(3);
      for (const word of words) expect(PRIVATE_CODE_WORDS).toContain(word);
    }
  });
});
