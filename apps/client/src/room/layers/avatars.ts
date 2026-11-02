import type { Occupant } from "@dormouse/protocol";
import { Container, Graphics } from "pixi.js";
import type { SceneLayer } from "./layer";
import { seatGeometry } from "./seat-geometry";

export function createAvatarsLayer(): SceneLayer {
  const container = new Container();
  const bodies = new Map<string, Graphics>();
  const positions = new Map<string, { bodyX: number; bodyY: number }>();
  let occupants: Occupant[] = [];
  let selfId = "";

  function sync() {
    const seen = new Set<string>();
    for (const occupant of occupants) {
      seen.add(occupant.id);
      let body = bodies.get(occupant.id);
      if (!body) {
        body = container.addChild(new Graphics());
        bodies.set(occupant.id, body);
      }
      const tint = occupant.id === selfId ? 0xf0e6ff : 0xa89cc0;
      body
        .clear()
        .circle(0, 0, 9)
        .fill({ color: tint, alpha: occupant.asleep ? 0.45 : 1 });
      const spot = occupant.seatId ? positions.get(occupant.seatId) : undefined;
      body.position.set(spot?.bodyX ?? 60, spot?.bodyY ?? 380);
    }
    for (const [id, body] of bodies) {
      if (seen.has(id)) continue;
      body.destroy();
      bodies.delete(id);
    }
  }

  return {
    slot: "avatars",
    attach({ container: slot }) {
      slot.addChild(container);
    },
    onRoomChange(room) {
      positions.clear();
      for (const seat of room.seats) positions.set(seat.id, seatGeometry(seat));
      sync();
    },
    onOccupantsChange(value, id) {
      occupants = value;
      selfId = id;
      sync();
    },
    destroy() {
      bodies.clear();
      positions.clear();
    },
  };
}
