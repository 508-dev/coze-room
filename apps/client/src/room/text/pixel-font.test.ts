import { describe, expect, it } from "vitest";
import { enPhrases } from "../../features/phrases/locale/en";
import { CHAR_HEIGHT, CHAR_WIDTH, PIXEL_FONT, pixelTextWidth } from "./pixel-font";

describe("pixel font", () => {
  it("covers every character in every shipped phrase", () => {
    for (const text of Object.values(enPhrases)) {
      for (const ch of text) {
        expect(ch === " " || PIXEL_FONT[ch]).toBeTruthy();
      }
    }
  });

  it("declares uniform 5x7 glyphs", () => {
    for (const glyph of Object.values(PIXEL_FONT)) {
      expect(glyph).toHaveLength(CHAR_HEIGHT);
      for (const row of glyph) expect(row).toHaveLength(CHAR_WIDTH);
    }
  });

  it("measures text including inter-glyph spacing", () => {
    expect(pixelTextWidth("")).toBe(0);
    expect(pixelTextWidth("hey")).toBe(17); // 3 glyphs (5px) + 2 gaps
    expect(pixelTextWidth("a b")).toBe(15); // 5 + gap + 3 (space) + gap + 5
  });
});
