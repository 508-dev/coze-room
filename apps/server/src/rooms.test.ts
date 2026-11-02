import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import art from "../../../packs/dormouse-v0/art.json";
import { Room } from "./room";
import { loadPublicRooms } from "./rooms";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "dormouse-room-art-"));
});
afterEach(() => {
  rmSync(directory, { recursive: true });
  vi.restoreAllMocks();
});

describe("defensive public-room art loading", () => {
  it("uses validated pack anchors when the file is present", () => {
    const file = join(directory, "art.json");
    writeFileSync(file, JSON.stringify(art));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [room] = loadPublicRooms(pathToFileURL(file));
    expect(room?.packId).toBe("dormouse-v0");
    for (const seat of room?.seats ?? []) {
      expect(seat).toMatchObject(art.seats[seat.id as keyof typeof art.seats].anchor);
    }
    expect(room?.seats).toHaveLength(4);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["malformed JSON", "{broken"],
    ["null metadata", "null"],
    ["missing seats", JSON.stringify({ ...art, seats: {} })],
    ["invalid dimensions", JSON.stringify({ ...art, imageSize: { width: 0, height: 72 } })],
    ["wrong version", JSON.stringify({ ...art, version: 2 })],
    [
      "out-of-bounds anchor",
      JSON.stringify({
        ...art,
        seats: { ...art.seats, hammock: { ...art.seats.hammock, anchor: { x: 999, y: 59 } } },
      }),
    ],
    [
      "string anchor",
      JSON.stringify({
        ...art,
        seats: { ...art.seats, hammock: { ...art.seats.hammock, anchor: { x: "62", y: 59 } } },
      }),
    ],
  ])("warns once and keeps a usable placeholder room for %s art", (_name, content) => {
    const file = join(directory, "art.json");
    if (content !== undefined) writeFileSync(file, content);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [spec] = loadPublicRooms(pathToFileURL(file));
    expect(spec).toBeDefined();
    if (!spec) throw new Error("missing fallback room");
    expect(Object.hasOwn(spec, "packId")).toBe(false);
    expect(spec.seats).toEqual([
      { id: "couch-l", kind: "couch", pose: "sit", x: 180, y: 300, depth: 2 },
      { id: "couch-r", kind: "couch", pose: "sit", x: 250, y: 300, depth: 2 },
      { id: "beanbag", kind: "beanbag", pose: "sit", x: 380, y: 340, depth: 3 },
      { id: "hammock", kind: "hammock", pose: "lie", x: 480, y: 250, depth: 1 },
    ]);
    expect(warn).toHaveBeenCalledOnce();
    const room = new Room(spec);
    room.join("a", "ada", { tone: 0, head: 0, top: 0, accessory: 0 }, { send() {} });
    room.takeSeat("a", "hammock");
    expect(room.occupants[0]?.seatId).toBe("hammock");
  });
});
