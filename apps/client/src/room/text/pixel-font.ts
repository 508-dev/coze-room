import type { Graphics } from "pixi.js";

/**
 * A hand-authored 5x7 bitmap font, rendered as 1px rects with nearest-neighbour
 * (vector) fill. Because it is drawn as hard rectangles there is no texture to
 * filter, so it stays crisp at every integer room scale — and because we wrote
 * it ourselves there is no font asset to licence or bundle. A space is narrower
 * than a glyph for natural word spacing.
 */
export const CHAR_WIDTH = 5;
export const CHAR_HEIGHT = 7;
export const GLYPH_SPACING = 1;
export const SPACE_WIDTH = 3;

export const PIXEL_FONT: Record<string, readonly string[]> = {
  a: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  b: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  c: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  d: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  e: [".###.", "#...#", "#....", "####.", "#....", "#...#", ".###."],
  f: [".###.", "#...#", "#....", "####.", "#....", "#....", "#...."],
  g: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  h: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  i: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  j: ["...##", "....#", "....#", "....#", "....#", "#...#", ".###."],
  k: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  l: ["#....", "#....", "#....", "#....", "#....", "#....", ".###."],
  m: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  n: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  o: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  p: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  r: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  s: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  t: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  u: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  v: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  x: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  y: ["#...#", "#...#", "#...#", ".###.", "....#", "#...#", ".###."],
  z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", "..#..", "..#.."],
  ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
};

function glyphWidth(ch: string): number {
  return ch === " " ? SPACE_WIDTH : CHAR_WIDTH;
}

/** Width in room pixels of `text`, including inter-glyph spacing. */
export function pixelTextWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += glyphWidth(ch) + GLYPH_SPACING;
  }
  return text.length === 0 ? 0 : width - GLYPH_SPACING;
}

/**
 * Appends the filled pixels of `text` to a Graphics as 1px rects, starting at
 * (x, y). The caller fills once afterwards with the desired colour.
 */
export function drawPixelText(g: Graphics, text: string, x: number, y: number): void {
  let cx = x;
  for (const ch of text) {
    if (ch === " ") {
      cx += SPACE_WIDTH + GLYPH_SPACING;
      continue;
    }
    const glyph = PIXEL_FONT[ch];
    if (!glyph) {
      // Unsupported character: reserve its width so layout stays predictable.
      cx += CHAR_WIDTH + GLYPH_SPACING;
      continue;
    }
    for (let row = 0; row < CHAR_HEIGHT; row++) {
      const line = glyph[row] ?? "";
      for (let col = 0; col < line.length; col++) {
        if (line[col] === "#") g.rect(cx + col, y + row, 1, 1);
      }
    }
    cx += CHAR_WIDTH + GLYPH_SPACING;
  }
}
