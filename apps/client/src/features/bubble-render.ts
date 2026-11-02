import { forEachPixel } from "../room/text/pixel-font";
import { BUBBLE_PAD_X, BUBBLE_PAD_Y, BUBBLE_TAIL_H, BUBBLE_TAIL_W } from "./bubbles";

const BUBBLE_BG = "rgba(13, 11, 20, 0.92)";
const BUBBLE_TEXT = "#cfc6e0";

/**
 * Draw a bubble into `canvas` at font-pixel resolution (one canvas pixel per
 * font pixel). The caller CSS-scales the canvas by an integer factor with
 * `image-rendering: pixelated`, so the glyphs stay crisp. `tailX` is the
 * tail's centre in font pixels, clamped into the canvas by the layout.
 */
export function drawBubble(canvas: HTMLCanvasElement, text: string, tailX: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const bodyH = canvas.height - BUBBLE_TAIL_H;
  const width = canvas.width;

  // Bubble body (rounded rectangle).
  ctx.fillStyle = BUBBLE_BG;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, bodyH, 2);
  ctx.fill();

  // Text.
  ctx.fillStyle = BUBBLE_TEXT;
  forEachPixel(text, (x, y) => ctx.fillRect(BUBBLE_PAD_X + x, BUBBLE_PAD_Y + y, 1, 1));

  // Tail: a downward triangle pointing at the speaker.
  ctx.fillStyle = BUBBLE_BG;
  const tailHalf = BUBBLE_TAIL_W / 2;
  for (let row = 0; row < BUBBLE_TAIL_H; row++) {
    const half = Math.max(0.5, tailHalf - row);
    const w = Math.round(half * 2);
    ctx.fillRect(Math.round(tailX - w / 2), bodyH + row, w, 1);
  }
}
