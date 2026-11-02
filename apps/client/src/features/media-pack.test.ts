import { describe, expect, it } from "vitest";
import realPack from "../../../../packs/dormouse-v0/manifest.json";
import { type PackManifest, validateManifest } from "../room/packs/manifest";
import { tvScreen } from "./media-pack";

const pack: PackManifest = {
  id: "test",
  version: 1,
  room: { size: [640, 360], background: "room.png" },
};

describe("TV pack screen", () => {
  it("uses the artist-authored real CRT screen, not the placeholder", () => {
    expect(tvScreen(validateManifest(realPack))).toEqual([106, 30, 8, 6]);
  });
  it("accepts integer room-space rectangles", () => {
    expect(tvScreen({ ...pack, sections: { tv: { screen: [20, 30, 64, 36] } } })).toEqual([
      20, 30, 64, 36,
    ]);
  });
  it.each([
    null,
    {},
    { screen: "invalid" },
    { screen: [-1, 2, 3, 4] },
    { screen: [0, 0, 0, 4] },
    { screen: [600, 0, 64, 36] },
    { screen: [1.5, 0, 64, 36] },
  ])("falls back on invalid section %j", (section) => {
    expect(tvScreen({ ...pack, sections: { tv: section } } as PackManifest)).toEqual(tvScreen());
  });
  it("keeps the fallback inside smaller packs", () => {
    expect(tvScreen({ ...pack, room: { ...pack.room, size: [40, 20] } })).toEqual([0, 0, 40, 20]);
  });
});
