import type { RoomSpec, Seat } from "@dormouse/protocol";
import { Container, Graphics, Rectangle } from "pixi.js";
import { occupantsSection } from "../art/occupants";
import type { LayerContext, SceneLayer } from "./layer";
import { seatGeometry } from "./seat-geometry";

const SEAT_COLOUR: Record<Seat["kind"], number> = {
  couch: 0x4a3b63,
  beanbag: 0x6b4f3a,
  hammock: 0x3a5563,
};

export function createSeatsLayer(): SceneLayer {
  const seats = new Container({ sortableChildren: true });
  let context: LayerContext;
  return {
    slot: "furnitureBack",
    attach(value) {
      context = value;
      context.container.addChild(seats);
    },
    onRoomChange(room: RoomSpec, pack) {
      for (const child of seats.removeChildren()) child.destroy();
      const art =
        pack && occupantsSection(pack.manifest.sections?.occupants, pack.manifest.room.size);
      for (const seat of room.seats) {
        if (art?.seats[seat.id]) {
          const target = new Container();
          // Centred on the furniture anchor (not its top-left), invisible but still hittable.
          target.position.set(seat.x, seat.y);
          target.hitArea = new Rectangle(-12, -15, 24, 18);
          target.eventMode = "static";
          target.cursor = "pointer";
          target.on("pointertap", () => context.events.emit("seatClick", { seatId: seat.id }));
          seats.addChild(target);
          continue;
        }
        const { width, height } = seatGeometry(seat);
        const graphic = new Graphics()
          .roundRect(0, 0, width, height, 6)
          .fill(SEAT_COLOUR[seat.kind]);
        graphic.position.set(seat.x, seat.y);
        graphic.zIndex = seat.depth;
        graphic.eventMode = "static";
        graphic.cursor = "pointer";
        graphic.on("pointertap", () => context.events.emit("seatClick", { seatId: seat.id }));
        seats.addChild(graphic);
      }
    },
    destroy() {},
  };
}
