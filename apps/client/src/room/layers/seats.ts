import type { RoomSpec, Seat } from "@dormouse/protocol";
import { Container, Graphics } from "pixi.js";
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
    onRoomChange(room: RoomSpec) {
      for (const child of seats.removeChildren()) child.destroy();
      for (const seat of room.seats) {
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
