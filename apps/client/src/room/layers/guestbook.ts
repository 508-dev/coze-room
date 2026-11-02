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
    /** Top-left of the chalkboard, in room-space pixels. */
    guestbook?: { spot: [number, number] };
  }
}

/** A sensible wall spot in the 640x360 placeholder, when no pack sets one. */
const DEFAULT_SPOT: [number, number] = [124, 76];
const BOARD_WIDTH = 152;
const BOARD_HEIGHT = 54;
const FRAME_COLOUR = 0x4a3626;
const BOARD_COLOUR = 0x1f2a1a;
const CHALK_COLOUR = 0xe8e2d0;

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
 * A chalkboard on the wall that reads as furniture and carries "N slept here
 * last night" in small pixel text. Placeholder art: a plain board plus a label,
 * to be replaced by a real indexed sprite later. Clicking toggles the detail
 * panel in the DOM.
 */
export function createGuestbookLayer(): SceneLayer {
  const root = new Container();
  let context: LayerContext | null = null;
  let sleepers: number | null = null;
  let spot: [number, number] = DEFAULT_SPOT;
  let offUpdate: (() => void) | null = null;

  root.eventMode = "static";
  root.cursor = "pointer";
  root.on("pointertap", () => context?.events.emit("guestbookClick", {}));

  function label(): string {
    if (sleepers === null) return "no one yet";
    if (sleepers === 0) return "no one slept here last night";
    return `${sleepers} slept here last night`;
  }

  function draw(): void {
    for (const child of root.removeChildren()) child.destroy();
    // `spot` is the board's centre; derive its top-left.
    const [cx, cy] = spot;
    const x = cx - BOARD_WIDTH / 2;
    const y = cy - BOARD_HEIGHT / 2;
    const frame = new Graphics().roundRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT, 4).fill(FRAME_COLOUR);
    frame.position.set(x, y);
    const board = new Graphics()
      .roundRect(3, 3, BOARD_WIDTH - 6, BOARD_HEIGHT - 6, 2)
      .fill(BOARD_COLOUR);
    board.position.set(x, y);
    const text = new Text({
      text: label(),
      style: { fontSize: 10, fontFamily: "monospace", fill: CHALK_COLOUR, align: "center" },
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
    onRoomChange(_room: RoomSpec, pack: LoadedPack | null) {
      spot = guestbookSpot(pack);
      draw();
    },
    destroy() {
      offUpdate?.();
    },
  };
}
