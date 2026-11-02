import { Texture } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPack } from "./loader";

const load = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>());
vi.mock("pixi.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("pixi.js")>()),
  Assets: { load },
}));

const manifest = {
  id: "fixture-v1",
  version: 1,
  room: { size: [640, 360], background: "room.png", windowViews: { rain: "rain.png" } },
};

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  load.mockReset();
});

describe("pack loading", () => {
  it("loads and validates manifest/textures through Pixi Assets with nearest sampling", async () => {
    const background = new Texture();
    const view = new Texture();
    load.mockImplementation(async (url) => {
      if (String(url).endsWith("manifest.json")) return manifest;
      return String(url).endsWith("rain.png") ? view : background;
    });
    const pack = await loadPack("fixture-v1", "/packs/");
    expect(pack?.manifest).toEqual(manifest);
    expect(pack?.background).toBe(background);
    expect(pack?.windowViews.rain).toBe(view);
    expect(background.source.scaleMode).toBe("nearest");
    expect(view.source.scaleMode).toBe("nearest");
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "/packs/fixture-v1/manifest.json",
      "/packs/fixture-v1/room.png",
      "/packs/fixture-v1/rain.png",
    ]);
  });

  it.each(["missing manifest", "invalid manifest", "wrong id", "missing texture"])(
    "warns and falls back for %s",
    async (failure) => {
      load.mockImplementation(async (url) => {
        if (failure === "missing manifest") throw new Error("404");
        if (failure === "invalid manifest") return { version: 2 };
        if (failure === "wrong id") return { ...manifest, id: "another-pack" };
        if (String(url).endsWith("manifest.json")) return manifest;
        throw new Error("missing image");
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(await loadPack("fixture-v1")).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    },
  );

  it("rejects an escaping pack id before issuing a request", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadPack("../escape")).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
