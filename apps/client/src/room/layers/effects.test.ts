import { Container, type Graphics, Texture } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../../../../packs/dormouse-v0/manifest.json";
import { RoomEvents } from "../events";
import type { LoadedPack } from "../packs/loader";
import { validateManifest } from "../packs/manifest";
import { createEnvironmentLayer } from "./environment";
import { createLightsLayer } from "./lights";

const pack: LoadedPack = {
  manifest: validateManifest(manifest),
  baseUrl: "/packs/dormouse-v0/",
  background: Texture.EMPTY,
  windowViews: { rain: Texture.EMPTY, "clear-night": Texture.WHITE },
};
const room = { id: "test", name: "test", capacity: 12, seats: [] };

function reducedMotion(initial: boolean) {
  let listener = () => {};
  const media = {
    matches: initial,
    addEventListener: vi.fn((_type: string, change: () => void) => {
      listener = change;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("window", { matchMedia: () => media });
  return {
    media,
    set(value: boolean) {
      media.matches = value;
      listener();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("reduced-motion environmental effects", () => {
  it.each(["rain", "clear-night"])(
    "suppresses %s initially and toggles it live without removing the view",
    (environment) => {
      const preference = reducedMotion(true);
      const slot = new Container();
      const events = new RoomEvents();
      const layer = createEnvironmentLayer();
      layer.attach({ container: slot, events, toRoomPoint: (point) => point });
      layer.onRoomChange?.(room, pack);
      events.emit("environmentChanged", { id: environment });
      const view = slot.children[0] as Container;
      const weather = view.children[1] as Graphics;
      layer.update?.(0.2, 0);
      expect(view.children[0]).toMatchObject({ texture: pack.windowViews[environment] });
      expect(weather.context.instructions).toHaveLength(0);

      preference.set(false);
      layer.update?.(0.2, 0); // same time bucket: preference changes must invalidate it
      expect(weather.context.instructions.length).toBeGreaterThan(0);
      preference.set(true);
      layer.update?.(0.2, 0);
      expect(weather.context.instructions).toHaveLength(0);
      layer.update?.(0.2, 4000);
      expect(weather.context.instructions).toHaveLength(0);
      expect(view.children).toHaveLength(2);
      layer.destroy();
      expect(preference.media.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
      slot.destroy({ children: true });
    },
  );

  it("suppresses palette flicker initially and live, and resumes both colour ramps", () => {
    const preference = reducedMotion(true);
    const [width, height] = pack.manifest.room.size;
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels.set([0xd1, 0xc7, 0x84, 255, 0x3f, 0x78, 0x87, 255]);
    const context = { drawImage: vi.fn(), getImageData: () => ({ data: pixels }) };
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
    const slot = new Container();
    const layer = createLightsLayer();
    layer.attach({ container: slot, events: new RoomEvents(), toRoomPoint: (point) => point });
    layer.onRoomChange?.(room, pack);
    const highlights = (slot.children[0] as Container).children[0] as Graphics;
    layer.update?.(0.2, 0);
    expect(highlights.context.instructions).toHaveLength(0);
    preference.set(false);
    layer.update?.(0.2, 0);
    expect(highlights.context.instructions).toHaveLength(2);
    expect(highlights.containsPoint({ x: 0.5, y: 0.5 })).toBe(true);
    expect(highlights.containsPoint({ x: 1.5, y: 0.5 })).toBe(true);
    preference.set(true);
    layer.update?.(0.2, 0);
    expect(highlights.context.instructions).toHaveLength(0);
    layer.update?.(0.2, 3500);
    expect(highlights.context.instructions).toHaveLength(0);
    preference.set(false);
    layer.update?.(0.2, 3500);
    expect(highlights.context.instructions).toHaveLength(1);
    layer.destroy();
    expect(preference.media.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    slot.destroy({ children: true });
  });
});
