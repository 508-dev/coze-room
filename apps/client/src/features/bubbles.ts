import type { Occupant, RoomSpec } from "@dormouse/protocol";
import type { RoomTransform } from "../room/events";
import { seatGeometry } from "../room/layers/seat-geometry";
import { CHAR_HEIGHT, pixelTextWidth } from "../room/text/pixel-font";

/**
 * Bubble geometry and lifetime, all in pure math so it is node-testable. The
 * text is drawn in screen space (not room space) at an integer screen scale so
 * it stays crisp and legible however tiny the room is rendered.
 */
export const BUBBLE_SCALE = 2; // integer: each font pixel becomes 2 CSS px
export const BUBBLE_LIFETIME_MS = 4_000;
export const BUBBLE_FADE_MS = 800;

export const BUBBLE_PAD_X = 4; // font px
export const BUBBLE_PAD_Y = 3; // font px
export const BUBBLE_TAIL_H = 3; // font px
export const BUBBLE_TAIL_W = 5; // font px
export const BUBBLE_GAP = 2; // font px between the tail tip and the head
export const BUBBLE_MARGIN = 8; // CSS px inside the viewport edge
export const ANNOUNCE_THROTTLE_MS = 2_500;

const HEAD_RADIUS = 9; // room px, matches the avatars layer
const STANDING = { bodyX: 60, bodyY: 380 }; // room px, matches the avatars layer

/** Speaker's head top-centre in room coordinates, or null if unknown. */
export function avatarHead(
  occupant: Occupant | undefined,
  room: RoomSpec | null,
): { x: number; y: number } | null {
  if (!occupant || !room) return null;
  const seat = occupant.seatId ? room.seats.find((s) => s.id === occupant.seatId) : undefined;
  const spot = seat ? seatGeometry(seat) : STANDING;
  return { x: spot.bodyX, y: spot.bodyY - HEAD_RADIUS };
}

export function toScreen(
  point: { x: number; y: number },
  transform: RoomTransform,
): { x: number; y: number } {
  return { x: transform.x + point.x * transform.scale, y: transform.y + point.y * transform.scale };
}

export interface BubbleLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Font-pixel x of the tail's centre within the canvas, for drawing. */
  tailX: number;
  /** Canvas backing dimensions in font pixels. */
  canvasWidth: number;
  canvasHeight: number;
}

/** Body size in CSS pixels (excludes the tail). */
export function bubbleSize(text: string): { width: number; height: number } {
  return {
    width: (pixelTextWidth(text) + BUBBLE_PAD_X * 2) * BUBBLE_SCALE,
    height: (CHAR_HEIGHT + BUBBLE_PAD_Y * 2) * BUBBLE_SCALE,
  };
}

/**
 * Position a bubble above `head` (screen CSS px), clamped inside `viewport`,
 * with its tail still pointing back at the speaker.
 */
export function layoutBubble(
  head: { x: number; y: number },
  text: string,
  viewport: { width: number; height: number },
): BubbleLayout {
  const textW = pixelTextWidth(text);
  const canvasWidth = textW + BUBBLE_PAD_X * 2;
  const bodyFontH = CHAR_HEIGHT + BUBBLE_PAD_Y * 2;
  const canvasHeight = bodyFontH + BUBBLE_TAIL_H;
  const width = canvasWidth * BUBBLE_SCALE;
  const height = bodyFontH * BUBBLE_SCALE;
  const tailHCss = BUBBLE_TAIL_H * BUBBLE_SCALE;
  const gapCss = BUBBLE_GAP * BUBBLE_SCALE;
  const margin = BUBBLE_MARGIN;

  const left = clamp(head.x - width / 2, margin, Math.max(margin, viewport.width - width - margin));
  const top = clamp(
    head.y - height - tailHCss - gapCss,
    margin,
    Math.max(margin, viewport.height - height - tailHCss - margin),
  );

  const tailHalf = BUBBLE_TAIL_W / 2;
  const tailX = clamp((head.x - left) / BUBBLE_SCALE, tailHalf + 1, canvasWidth - tailHalf - 1);

  return {
    left: Math.round(left),
    top: Math.round(top),
    width,
    height,
    tailX: Math.round(tailX),
    canvasWidth,
    canvasHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Alpha (0..1) for a bubble `elapsedMs` into its life. */
export function bubbleAlpha(elapsedMs: number): number {
  if (elapsedMs >= BUBBLE_LIFETIME_MS) return 0;
  const fadeStart = BUBBLE_LIFETIME_MS - BUBBLE_FADE_MS;
  if (elapsedMs <= fadeStart) return 1;
  return 1 - (elapsedMs - fadeStart) / BUBBLE_FADE_MS;
}

export function bubbleExpired(elapsedMs: number): boolean {
  return elapsedMs >= BUBBLE_LIFETIME_MS;
}

/** True when `now` is still inside the announce throttle window from `last`. */
export function withinThrottle(last: number | null, now: number): boolean {
  return last !== null && now - last < ANNOUNCE_THROTTLE_MS;
}
