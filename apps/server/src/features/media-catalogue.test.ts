import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AvatarLook, MediaItem, ServerMessage } from "@dormouse/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Room } from "../room";
import { PUBLIC_ROOMS } from "../rooms";
import { createMediaFeature } from "./media";
import { loadMediaCatalogue } from "./media-catalogue";
import { createSeatingFeature } from "./seating";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const item: MediaItem = {
  id: "one",
  title: "One",
  year: 1900,
  silent: true,
  durationSeconds: 10,
  licence: "PD",
};
const spec = PUBLIC_ROOMS[0];
if (!spec) throw new Error("no public room");

describe("optional runtime media catalogue", () => {
  let directory: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "dormouse-catalogue-test-"));
  });
  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["missing file", "malformed JSON"])(
    "keeps rooms and seating alive with TV off for %s and logs once across rooms",
    async (failure) => {
      const path = join(directory, failure === "missing file" ? "missing.json" : "malformed.json");
      if (failure === "malformed JSON") await writeFile(path, "{invalid JSON");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      for (let index = 0; index < 2; index++) {
        const room = new Room(spec, [
          createSeatingFeature,
          () => createMediaFeature(undefined, path),
        ]);
        const sent: ServerMessage[] = [];
        const socket = { send: (raw: string) => sent.push(JSON.parse(raw)) };
        room.join("a", "ada", LOOK, socket);
        expect(sent[0]).toMatchObject({
          t: "welcome",
          media: { itemId: null, startedAt: 0 },
          mediaCatalogue: [],
        });
        room.handleMessage("a", { t: "takeSeat", seatId: "hammock" }, socket);
        expect(room.occupants[0]?.seatId).toBe("hammock");
        room.tick();
        room.handleMessage("a", { t: "mediaSync", sentAt: 123 }, socket);
        expect(sent.at(-1)).toMatchObject({ t: "media", media: { itemId: null, startedAt: 0 } });
        room.destroy();
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "Could not load media catalogue; the TV is off.",
        expect.any(Error),
      );
    },
  );

  it.each([
    null,
    {},
    { schemaVersion: 1, items: {} },
    { schemaVersion: 2, items: [item] },
    { schemaVersion: 1, items: [null] },
    { schemaVersion: 1, items: [item, item] },
    ...[
      { id: "../source" },
      { title: "" },
      { year: "1900" },
      { silent: "yes" },
      { durationSeconds: "10" },
      { durationSeconds: 0 },
      { durationSeconds: -1 },
      { durationSeconds: 1e100 },
      { licence: null },
      { attribution: {} },
    ].map((override) => ({ schemaVersion: 1, items: [item, { ...item, id: "two", ...override }] })),
  ])("disables the entire catalogue for a malformed shape/item: %j", async (value) => {
    const path = join(directory, "bad-shape.json");
    await writeFile(path, JSON.stringify(value));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadMediaCatalogue(path)).toEqual([]);
  });

  it("accepts empty catalogues and projects only valid public metadata", async () => {
    const path = join(directory, "valid.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, items: [] }));
    const warn = vi.spyOn(console, "warn");
    expect(loadMediaCatalogue(path)).toEqual([]);
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: 1,
        items: [{ ...item, sourceUrl: "https://example.com/source.mp4" }],
      }),
    );
    expect(loadMediaCatalogue(path)).toEqual([item]);
    expect(warn).not.toHaveBeenCalled();
  });
});
