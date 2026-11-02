import { describe, expect, it } from "vitest";
import fixture from "../../../../../packs/test-fixture/manifest.json";
import { validateManifest } from "./manifest";

describe("pack manifest v1", () => {
  it("accepts the shipped fixture", () => {
    expect(validateManifest(fixture)).toEqual(fixture);
  });

  it("preserves optional window views and feature-owned sections", () => {
    const manifest = {
      ...fixture,
      room: { ...fixture.room, windowViews: { rain: "views/rain.png" } },
      sections: { audio: { rain: "rain.ogg" } },
    };
    expect(validateManifest(manifest)).toEqual(manifest);
  });

  it.each([null, [], {}, { ...fixture, id: "../escape" }, { ...fixture, version: 2 }])(
    "rejects invalid envelope: %j",
    (manifest) => expect(() => validateManifest(manifest)).toThrow(),
  );

  it.each([[0, 360], [640, -1], [1.5, 360], [640], [640, 360, 1], ["640", 360]])(
    "rejects invalid dimensions: %j",
    (...size) =>
      expect(() => validateManifest({ ...fixture, room: { ...fixture.room, size } })).toThrow(),
  );

  it.each([
    "",
    "../outside.png",
    "/absolute.png",
    "https://other/art.png",
    "a/../b.png",
    "a%2fb.png",
    "a\\b.png",
  ])("rejects unsafe asset path: %s", (background) =>
    expect(() => validateManifest({ ...fixture, room: { ...fixture.room, background } })).toThrow(),
  );

  it.each([[], null, { rain: 123 }, { rain: "../escape.png" }])(
    "rejects invalid window views: %j",
    (windowViews) =>
      expect(() =>
        validateManifest({ ...fixture, room: { ...fixture.room, windowViews } }),
      ).toThrow(),
  );

  it("rejects non-object extension sections", () => {
    expect(() => validateManifest({ ...fixture, sections: [] })).toThrow();
  });
});
