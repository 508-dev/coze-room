import { Container, EventBoundary, FederatedPointerEvent, Text, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { RoomEvents } from "../events";
import type { LoadedPack } from "../packs/loader";
import { createGuestbookLayer, guestbookSpot } from "./guestbook";

function pack(sections: unknown, size: [number, number] = [640, 360]): LoadedPack {
  return {
    manifest: {
      id: "test-fixture",
      version: 1,
      room: { size, background: "background.svg" },
      ...(sections === undefined ? {} : { sections }),
    },
    baseUrl: "/packs/test-fixture/",
    background: Texture.EMPTY,
    windowViews: {},
  } as unknown as LoadedPack;
}

describe("guestbookSpot", () => {
  it("defaults to a sensible wall centre without a pack", () => {
    expect(guestbookSpot(null)).toEqual([124, 76]);
  });

  it("uses the pack section's centre when valid", () => {
    expect(guestbookSpot(pack({ guestbook: { spot: [120, 200] } }))).toEqual([120, 200]);
  });

  it.each([
    { guestbook: { spot: [1.5, 200] } },
    { guestbook: { spot: [-1, 200] } },
    { guestbook: { spot: [700, 200] } },
    { guestbook: { spot: [120, 999] } },
    { guestbook: { spot: "nope" } },
    { guestbook: { spot: [120] } },
  ])("falls back when the spot is invalid: %j", (sections) => {
    expect(guestbookSpot(pack(sections))).toEqual([124, 76]);
  });
});

describe("guestbook layer", () => {
  it("toggles the detail panel via a click event", () => {
    const container = new Container();
    const events = new RoomEvents();
    const onOpen = vi.fn();
    events.on("guestbookClick", onOpen);
    const layer = createGuestbookLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.({ id: "r", name: "r", seats: [], capacity: 1 }, null);

    const root = container.children[0] as Container;
    root.emit("pointertap", new FederatedPointerEvent(new EventBoundary(container)));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith({});
    layer.destroy();
    container.destroy({ children: true });
  });

  it("renders the last-night count pushed by the feature", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createGuestbookLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.({ id: "r", name: "r", seats: [], capacity: 1 }, null);

    events.emit("guestbookUpdate", { sleepers: 12 });
    const root = container.children[0] as Container;
    const text = () => root.children.find((c) => c instanceof Text) as Text;
    expect(text().text).toBe("12");

    events.emit("guestbookUpdate", { sleepers: 0 });
    expect(text().text).toBe("0");

    events.emit("guestbookUpdate", { sleepers: null });
    expect(text().text).toBe("");

    layer.destroy();
    container.destroy({ children: true });
  });

  it("centres the board on the pack spot", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createGuestbookLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    // Real pack: 128x72 room, guestbook centre at [72, 39] -> board is 16x10.
    layer.onRoomChange?.(
      { id: "r", name: "r", seats: [], capacity: 1 },
      pack({ guestbook: { spot: [72, 39] } }, [128, 72]),
    );

    const root = container.children[0] as Container;
    const frame = root.children[0] as Container;
    expect(frame.position.x).toBe(64);
    expect(frame.position.y).toBe(34);

    layer.destroy();
    container.destroy({ children: true });
  });
});
