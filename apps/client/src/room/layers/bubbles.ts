import type { Occupant, RoomSpec } from "@dormouse/protocol";
import { Container, Graphics } from "pixi.js";
import { CHAR_HEIGHT, drawPixelText, pixelTextWidth } from "../text/pixel-font";
import type { LayerContext, SceneLayer } from "./layer";
import { seatGeometry } from "./seat-geometry";

export const BUBBLE_LIFETIME_MS = 4_000;
export const BUBBLE_FADE_MS = 800;

const BUBBLE_PAD_X = 4;
const BUBBLE_PAD_Y = 3;
const BUBBLE_RADIUS = 2;
const BUBBLE_BG = 0x0d0b14;
const BUBBLE_BG_ALPHA = 0.9;
const BUBBLE_TEXT = 0xcfc6e0;
/** Gap between the top of the avatar's head and the bottom of its bubble. */
const BUBBLE_ABOVE_HEAD = 3;
const HEAD_RADIUS = 9;
/** Standing occupants (no seat) draw here, matching the avatars layer. */
const STANDING = { bodyX: 60, bodyY: 380 };

interface Bubble {
  container: Container;
  /** Clock of the first update after creation; drives lifetime deterministically. */
  bornAt: number | null;
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

/** One short-lived bubble per speaker, drawn above the avatar in room space. */
export function createBubblesLayer(): SceneLayer {
  const root = new Container();
  const bubbles = new Map<string, Bubble>();
  let occupants: Occupant[] = [];
  let seatPositions = new Map<string, { bodyX: number; bodyY: number }>();
  let offPhrase: (() => void) | null = null;

  function avatarPosition(id: string) {
    const occupant = occupants.find((o) => o.id === id);
    const spot = occupant?.seatId ? seatPositions.get(occupant.seatId) : undefined;
    return spot ?? STANDING;
  }

  function show(id: string, text: string): void {
    // A new phrase replaces that speaker's previous bubble.
    const existing = bubbles.get(id);
    if (existing) {
      existing.container.destroy({ children: true });
      bubbles.delete(id);
    }

    const { bodyX, bodyY } = avatarPosition(id);
    const width = pixelTextWidth(text) + BUBBLE_PAD_X * 2;
    const height = CHAR_HEIGHT + BUBBLE_PAD_Y * 2;
    const container = new Container();
    const bg = new Graphics().roundRect(0, 0, width, height, BUBBLE_RADIUS).fill({
      color: BUBBLE_BG,
      alpha: BUBBLE_BG_ALPHA,
    });
    const textG = new Graphics();
    drawPixelText(textG, text, BUBBLE_PAD_X, BUBBLE_PAD_Y);
    textG.fill({ color: BUBBLE_TEXT });
    container.addChild(bg, textG);
    // Anchor the bubble's bottom-centre just above the avatar's head.
    container.position.set(
      Math.round(bodyX - width / 2),
      Math.round(bodyY - HEAD_RADIUS - BUBBLE_ABOVE_HEAD - height),
    );
    root.addChild(container);
    bubbles.set(id, { container, bornAt: null });
  }

  return {
    slot: "bubbles",
    attach({ container, events }: LayerContext) {
      container.addChild(root);
      offPhrase = events.on("phrase", ({ id, text }) => show(id, text));
    },
    update(_dt, now) {
      for (const [id, bubble] of bubbles) {
        bubble.bornAt ??= now;
        const elapsed = now - bubble.bornAt;
        if (bubbleExpired(elapsed)) {
          bubble.container.destroy({ children: true });
          bubbles.delete(id);
        } else {
          bubble.container.alpha = bubbleAlpha(elapsed);
        }
      }
    },
    onRoomChange(room: RoomSpec) {
      seatPositions = new Map(room.seats.map((seat) => [seat.id, seatGeometry(seat)]));
    },
    onOccupantsChange(value: Occupant[]) {
      occupants = value;
    },
    destroy() {
      offPhrase?.();
      offPhrase = null;
      for (const bubble of bubbles.values()) bubble.container.destroy({ children: true });
      bubbles.clear();
    },
  };
}
