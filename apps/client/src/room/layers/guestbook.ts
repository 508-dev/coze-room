import type { RoomSpec } from "@dormouse/protocol";
import { Container, Graphics, Text } from "pixi.js";
import type { LoadedPack } from "../packs/loader";
import { PLACEHOLDER_SIZE } from "../space";
import type { LayerContext, SceneLayer } from "./layer";

// Feature-owned scene/DOM events, added by declaration merging (see frontend.md).
declare module "../events" {
  interface SceneEvents {
    /** Clicking the in-scene object toggles the detail panel. */
    guestbookClick: Record<string, never>;
    /** The scene layer asks the feature for the current count after it attaches. */
    guestbookRequest: Record<string, never>;
    /** The feature pushes the latest "last night" sleeper count to the layer. */
    guestbookUpdate: { sleepers: number | null };
  }
}

// Feature-owned pack section, validated here (see frontend.md).
declare module "../packs/manifest" {
  interface PackSections {
    /** Centre of the chalkboard, in room-space pixels (from art.json's rect). */
    guestbook?: { spot: [number, number] };
  }
}

/** A sensible wall centre in the 640x360 placeholder, when no pack sets one. */
const DEFAULT_SPOT: [number, number] = [124, 76];
const FRAME_COLOUR = 0x4a3626;
const BOARD_COLOUR = 0x1f2a1a;
const CHALK_COLOUR = 0xe8e2d0;

/** A small chalkboard: about 1/8 the room wide, 1/7 tall, matching the pack art. */
function boardSize([w, h]: readonly [number, number]): [number, number] {
  return [Math.max(12, Math.round(w / 8)), Math.max(8, Math.round(h / 7))];
}

/**
 * Resolve a valid board centre from the pack section, else the default. The
 * pack contract (PR #72) writes `sections.guestbook.spot` as the rect centre,
 * in room-space pixels.
 */
export function guestbookSpot(pack: LoadedPack | null): [number, number] {
  const [width, height] = pack?.manifest.room.size ?? PLACEHOLDER_SIZE;
  const spot = pack?.manifest.sections?.guestbook?.spot;
  if (
    Array.isArray(spot) &&
    spot.length === 2 &&
    spot.every((n) => Number.isInteger(n) && n >= 0) &&
    (spot[0] as number) <= width &&
    (spot[1] as number) <= height
  ) {
    return [spot[0] as number, spot[1] as number];
  }
  return DEFAULT_SPOT;
}

/**
 * A chalkboard on the wall that reads as furniture. Placeholder art: a plain
 * board plus a short count label (the room is too small for a full sentence;
 * the DOM panel carries "N slept here last night"). The count stays Pixi text
 * until a bitmap font lands after #73.
 */
export function createGuestbookLayer(): SceneLayer {
  const root = new Container();
  let context: LayerContext | null = null;
  let sleepers: number | null = null;
  let spot: [number, number] = DEFAULT_SPOT;
  let size: readonly [number, number] = PLACEHOLDER_SIZE;
  let offUpdate: (() => void) | null = null;

  root.eventMode = "static";
  root.cursor = "pointer";
  root.on("pointertap", () => context?.events.emit("guestbookClick", {}));

  function label(): string {
    return sleepers === null ? "" : String(sleepers);
  }

  function draw(): void {
    for (const child of root.removeChildren()) child.destroy();
    const [cx, cy] = spot;
    const [width, height] = boardSize(size);
    const x = Math.round(cx - width / 2);
    const y = Math.round(cy - height / 2);
    const frame = new Graphics().roundRect(0, 0, width, height, 2).fill(FRAME_COLOUR);
    frame.position.set(x, y);
    const board = new Graphics().roundRect(2, 2, width - 4, height - 4, 1).fill(BOARD_COLOUR);
    board.position.set(x, y);
    const text = new Text({
      text: label(),
      style: {
        fontSize: Math.max(3, Math.round(height / 2)),
        fontFamily: "monospace",
        fill: CHALK_COLOUR,
      },
    });
    text.anchor.set(0.5);
    text.position.set(cx, cy);
    root.addChild(frame, board, text);
  }

  return {
    slot: "furnitureBack",
    attach(value) {
      context = value;
      context.container.addChild(root);
      offUpdate = context.events.on("guestbookUpdate", ({ sleepers: next }) => {
        sleepers = next;
        draw();
      });
      // If the welcome already arrived before this layer attached, ask for it.
      context.events.emit("guestbookRequest", {});
    },
    onRoomChange(room: RoomSpec, pack: LoadedPack | null) {
      size = pack?.manifest.room.size ?? PLACEHOLDER_SIZE;
      spot = guestbookSpot(pack);
      draw();
    },
    destroy() {
      offUpdate?.();
    },
  };
}
