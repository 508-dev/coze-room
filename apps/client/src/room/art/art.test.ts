import { Container, EventBoundary, FederatedPointerEvent, Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import manifest from "../../../../../packs/dormouse-v0/manifest.json";
import { RoomEvents } from "../events";
import { createEnvironmentLayer } from "../layers/environment";
import { createSeatsLayer } from "../layers/seats";
import type { LoadedPack } from "../packs/loader";
import { validateManifest } from "../packs/manifest";
import { glassRects, inGlass } from "./environment";
import { headCenters, occupantsSection } from "./occupants";

const pack: LoadedPack = {
  manifest: validateManifest(manifest),
  baseUrl: "/packs/dormouse-v0/",
  background: Texture.EMPTY,
  windowViews: { rain: Texture.EMPTY, "clear-night": Texture.WHITE },
};
const room = {
  id: "room",
  name: "room",
  capacity: 12,
  seats: [{ id: "couch-l", kind: "couch" as const, pose: "sit" as const, x: 42, y: 59, depth: 1 }],
};

describe("pack art contract", () => {
  it("validates all generated occupant metadata and rejects unsafe paths/bounds", () => {
    const section = manifest.sections.occupants;
    expect(occupantsSection(section, [128, 72])).not.toBeNull();
    for (const file of ["../escape.png", "https://example.com/image.png", "/absolute.png"]) {
      expect(
        occupantsSection(
          { ...section, sprites: { [file]: Object.values(section.sprites)[0] } },
          [128, 72],
        ),
      ).toBeNull();
    }
    expect(
      occupantsSection(
        {
          ...section,
          sprites: { "a.png": { ...Object.values(section.sprites)[0], breathRow: 999 } },
        },
        [128, 72],
      ),
    ).toBeNull();
  });

  it("derives each seat's head top-centre from the occupant sprites", () => {
    const section = occupantsSection(manifest.sections.occupants, [128, 72]);
    if (!section) throw new Error("invalid occupants section");
    expect(headCenters(section)).toEqual({
      "couch-l": { x: 42, y: 32 },
      "couch-r": { x: 65, y: 33 },
      beanbag: { x: 18, y: 39 },
      hammock: { x: 91.5, y: 40 },
    });
  });

  it("keeps every rain cell in actual glass rectangles", () => {
    const glass = glassRects(manifest.sections.environment, [128, 72]);
    const first = glass[0];
    if (!first) throw new Error("no glass");
    const [x, y, w, h] = first;
    expect(inGlass(x, y, glass)).toBe(true);
    expect(inGlass(x + w - 1, y + h - 1, glass)).toBe(true);
    expect(inGlass(x + w, y, glass)).toBe(false);
    expect(inGlass(x, y + h, glass)).toBe(false);
    expect(glassRects({ glass: [[0, 0, 999, 999]] }, [128, 72])).toEqual([]);
  });

  it("selects the first view without an audio feature, reacts to shared environment events and unsubscribes", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createEnvironmentLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, pack);
    const views = container.children[0] as Container;
    expect(views.children[0]).toMatchObject({ texture: Texture.EMPTY });
    events.emit("environmentChanged", { id: "clear-night" });
    expect(views.children[0]).toMatchObject({ texture: Texture.WHITE });
    layer.update?.(0.2, 2000);
    layer.onRoomChange?.(room, null);
    expect(views.children).toHaveLength(1); // only the empty weather graphic
    layer.destroy();
    container.destroy({ children: true });
    expect(() => events.emit("environmentChanged", { id: "rain" })).not.toThrow();
  });

  it("uses invisible centred seat hit areas over the room painting", () => {
    const container = new Container();
    const events = new RoomEvents();
    const click = vi.fn();
    events.on("seatClick", click);
    const layer = createSeatsLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, pack);
    const target = (container.children[0] as Container).children[0];
    expect(target?.children).toHaveLength(0);
    expect(target?.hitArea?.contains(0, 0)).toBe(true);
    target?.emit("pointertap", new FederatedPointerEvent(new EventBoundary(container)));
    expect(click).toHaveBeenCalledWith({ seatId: "couch-l" });
    layer.destroy();
    container.destroy({ children: true });
  });

  it("requests the current shared environment when attaching after welcome", () => {
    const container = new Container();
    const events = new RoomEvents();
    // The feature already processed a clear-night welcome before Pixi was ready.
    const respond = vi.fn(() => events.emit("environmentChanged", { id: "clear-night" }));
    events.on("environmentRequested", respond);
    const layer = createEnvironmentLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    expect(respond).toHaveBeenCalledOnce();
    layer.onRoomChange?.(room, pack);
    const views = container.children[0] as Container;
    expect(views.children[0]).toMatchObject({ texture: Texture.WHITE });
    layer.destroy();
    container.destroy({ children: true });
  });
});
