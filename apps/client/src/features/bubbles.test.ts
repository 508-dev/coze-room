import type { Occupant } from "@dormouse/protocol";
import { describe, expect, it } from "vitest";
import { PUBLIC_ROOMS } from "../../../server/src/rooms";
import {
  ANNOUNCE_THROTTLE_MS,
  avatarHead,
  BUBBLE_FADE_MS,
  BUBBLE_LIFETIME_MS,
  BUBBLE_MARGIN,
  BUBBLE_SCALE,
  BUBBLE_TAIL_H,
  BUBBLE_TAIL_W,
  bubbleAlpha,
  bubbleExpired,
  bubbleSize,
  layoutBubble,
  toScreen,
  withinThrottle,
} from "./bubbles";
import { enPhrases } from "./phrases/locale/en";

const room = PUBLIC_ROOMS[0];
if (!room) throw new Error("no public room");

const occupant: Occupant = {
  id: "a",
  name: "ada",
  seatId: "hammock",
  asleep: false,
  look: { tone: 0, head: 0, top: 0, accessory: 0 },
};

const longest = Object.values(enPhrases).sort((a, b) => b.length - a.length)[0] ?? "hey";
const viewport = { width: 360, height: 640 };
const tailHalf = BUBBLE_TAIL_W / 2;

describe("bubble lifetime", () => {
  it("holds full opacity, then fades to zero at the lifetime", () => {
    expect(bubbleAlpha(0)).toBe(1);
    expect(bubbleAlpha(BUBBLE_LIFETIME_MS - BUBBLE_FADE_MS)).toBe(1);
    expect(bubbleAlpha(BUBBLE_LIFETIME_MS - BUBBLE_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(bubbleAlpha(BUBBLE_LIFETIME_MS)).toBe(0);
  });

  it("expires exactly at the lifetime", () => {
    expect(bubbleExpired(BUBBLE_LIFETIME_MS - 1)).toBe(false);
    expect(bubbleExpired(BUBBLE_LIFETIME_MS)).toBe(true);
  });
});

describe("bubble positioning", () => {
  it("finds the seated and standing head positions in room space", () => {
    // Hammock body centre is (524, 238); head sits 9px above it.
    expect(avatarHead(occupant, room)).toEqual({ x: 524, y: 229 });
    // A standing occupant defaults to the shared standing spot.
    expect(avatarHead({ ...occupant, seatId: null }, room)).toEqual({ x: 60, y: 371 });
    expect(avatarHead(undefined, room)).toBeNull();
  });

  it("maps a room point to screen space through the transform", () => {
    expect(toScreen({ x: 5, y: 7 }, { scale: 2, x: 10, y: 20, width: 360, height: 640 })).toEqual({
      x: 20,
      y: 34,
    });
  });

  it("keeps the longest phrase inside the viewport at the left edge", () => {
    expect(bubbleSize(longest).width).toBeLessThan(viewport.width);
    const layout = layoutBubble({ x: 0, y: 300 }, longest, viewport);
    expect(layout.left).toBe(BUBBLE_MARGIN);
    expect(layout.top).toBeGreaterThanOrEqual(BUBBLE_MARGIN);
    expect(layout.tailX).toBeGreaterThanOrEqual(tailHalf);
    expect(layout.tailX).toBeLessThanOrEqual(layout.canvasWidth - tailHalf);
  });

  it("keeps the longest phrase inside the viewport at the right edge", () => {
    const layout = layoutBubble({ x: viewport.width, y: 300 }, longest, viewport);
    expect(layout.left).toBe(viewport.width - layout.width - BUBBLE_MARGIN);
    expect(layout.tailX).toBeLessThanOrEqual(layout.canvasWidth - tailHalf);
  });

  it("clamps a bubble whose speaker is below the viewport (standing)", () => {
    const layout = layoutBubble({ x: 60, y: viewport.height + 100 }, "hi there", viewport);
    const tailHCss = BUBBLE_TAIL_H * BUBBLE_SCALE;
    expect(layout.top).toBe(viewport.height - layout.height - tailHCss - BUBBLE_MARGIN);
    expect(layout.top).toBeGreaterThanOrEqual(BUBBLE_MARGIN);
  });

  it("points the tail at the speaker even when the bubble is clamped", () => {
    // Speaker at the far left, bubble clamped to the left margin: the tail must
    // sit at the bubble's left edge, not its centre.
    const layout = layoutBubble({ x: 0, y: 300 }, "hey", viewport);
    expect(layout.left).toBe(BUBBLE_MARGIN);
    expect(layout.tailX).toBe(Math.round(tailHalf + 1));
  });
});

describe("announce throttling", () => {
  it("suppresses announcements within the throttle window", () => {
    expect(withinThrottle(null, 0)).toBe(false);
    expect(withinThrottle(0, ANNOUNCE_THROTTLE_MS - 1)).toBe(true);
    expect(withinThrottle(0, ANNOUNCE_THROTTLE_MS)).toBe(false);
  });
});
