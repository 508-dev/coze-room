import type { Occupant } from "@dormouse/protocol";
import { Container, Texture, TextureSource } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import manifest from "../../../../../packs/dormouse-v0/manifest.json";
import { breathingOffset } from "../art/motion";
import { RoomEvents } from "../events";
import type { LoadedPack } from "../packs/loader";
import { validateManifest } from "../packs/manifest";
import { createAvatarsLayer } from "./avatars";

const load = vi.hoisted(() => vi.fn());
vi.mock("../art/occupants", async (original) => ({
  ...(await original<typeof import("../art/occupants")>()),
  loadOccupantTextures: load,
}));
const pack: LoadedPack = {
  manifest: validateManifest(manifest),
  baseUrl: "/packs/dormouse-v0/",
  background: Texture.EMPTY,
  windowViews: {},
};
const room = { id: "test", name: "test", seats: [], capacity: 12 };
const occupant: Occupant = {
  id: "ada",
  name: "ada",
  seatId: "couch-l",
  asleep: false,
  look: { tone: 0, head: 0, top: 0, accessory: 0 },
};
beforeEach(() => {
  load.mockReset();
});

function setup() {
  const slot = new Container();
  const layer = createAvatarsLayer();
  layer.attach({ container: slot, events: new RoomEvents(), toRoomPoint: (p) => p });
  return { slot, layer, bodies: slot.children[0] as Container };
}

describe("per-seat occupant rendering", () => {
  it("handles async load, sleep, motion, removal and unseated presence without destroying cached textures", async () => {
    const texture = new Texture({ source: new TextureSource({ width: 128, height: 72 }) });
    load.mockResolvedValue(
      new Map(Object.keys(manifest.sections.occupants.sprites).map((file) => [file, texture])),
    );
    const { slot, layer, bodies } = setup();
    layer.onOccupantsChange?.([occupant], "ada");
    layer.onRoomChange?.(room, pack);
    await Promise.resolve();
    expect(bodies.children).toHaveLength(1);
    const first = bodies.children[0] as Container;
    layer.update?.(0.2, 2000);
    expect(first.children[1]?.y).toBe(breathingOffset(2000, "ada", false));
    expect(first.children[2]?.visible).toBe(false);
    layer.onOccupantsChange?.([{ ...occupant, asleep: true }], "ada");
    expect(first.destroyed).toBe(true);
    layer.update?.(0.2, 2000);
    expect((bodies.children[0] as Container).children[1]?.y).toBe(
      breathingOffset(2000, "ada", true),
    );
    layer.onOccupantsChange?.([{ ...occupant, seatId: null }], "ada");
    expect(bodies.children).toHaveLength(0);
    layer.destroy();
    slot.destroy({ children: true });
    expect(texture.destroyed).toBe(false);
    texture.destroy(true);
  });

  it("ignores an old room's late texture load", async () => {
    let resolve = (_textures: Map<string, Texture>) => {};
    load.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { slot, layer, bodies } = setup();
    layer.onRoomChange?.(room, pack);
    layer.onOccupantsChange?.([occupant], "ada");
    layer.onRoomChange?.(room, null);
    resolve(new Map());
    await Promise.resolve();
    expect(bodies.children[0]).toBeDefined(); // retained placeholder, not a stale empty art scene
    layer.destroy();
    slot.destroy({ children: true });
  });
});
