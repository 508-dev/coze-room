import type { Occupant } from "@dormouse/protocol";
import { Container, EventBoundary, FederatedPointerEvent } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_ROOMS } from "../../../../server/src/rooms";
import { RoomEvents } from "../events";
import { createAvatarsLayer } from "./avatars";
import { createBackgroundLayer } from "./background";
import { SCENE_SLOTS } from "./layer";
import { createSeatsLayer } from "./seats";

const room = PUBLIC_ROOMS[0];
if (!room) throw new Error("no public room");

describe("placeholder scene layers", () => {
  it("reserves window views behind room art and occluders in front of avatars", () => {
    expect(SCENE_SLOTS.indexOf("windowView")).toBeLessThan(
      SCENE_SLOTS.indexOf(createBackgroundLayer().slot),
    );
    expect(SCENE_SLOTS.indexOf("avatars")).toBeLessThan(SCENE_SLOTS.indexOf("furnitureFront"));
  });

  it("keeps seats clickable and destroys old hit targets on a room change", () => {
    const container = new Container();
    const onSeatClick = vi.fn();
    const events = new RoomEvents();
    events.on("seatClick", onSeatClick);
    const layer = createSeatsLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, null);
    const seats = container.children[0] as Container;
    expect(seats.children).toHaveLength(4);
    const couch = seats.children[0];
    if (!couch) throw new Error("missing couch");
    couch.emit("pointertap", new FederatedPointerEvent(new EventBoundary(container)));
    expect(onSeatClick).toHaveBeenCalledExactlyOnceWith({ seatId: "couch-l" });
    layer.onRoomChange?.(room, null);
    expect(couch.destroyed).toBe(true);
    expect(seats.children).toHaveLength(4);
    layer.destroy();
    container.destroy({ children: true });
  });

  it("updates avatar positions regardless of snapshot order and removes departed bodies", () => {
    const container = new Container();
    const layer = createAvatarsLayer();
    layer.attach({ container, events: new RoomEvents(), toRoomPoint: (p) => p });
    const occupant: Occupant = {
      id: "a",
      name: "ada",
      seatId: "hammock",
      asleep: false,
      look: { tone: 0, head: 0, top: 0, accessory: 0 },
    };
    layer.onOccupantsChange?.([occupant], "a");
    layer.onRoomChange?.(room, null);
    const bodies = container.children[0] as Container;
    expect(bodies.children[0]?.position).toMatchObject({ x: 524, y: 238 });
    layer.onRoomChange?.({ ...room, seats: room.seats.map((s) => ({ ...s, x: s.x + 10 })) }, null);
    expect(bodies.children[0]?.position).toMatchObject({ x: 534, y: 238 });
    layer.onOccupantsChange?.([], "a");
    expect(bodies.children).toHaveLength(0);
    layer.destroy();
    container.destroy({ children: true });
  });
});
