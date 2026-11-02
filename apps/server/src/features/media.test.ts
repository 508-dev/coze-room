import type { AvatarLook, MediaItem, ServerMessage } from "@dormouse/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Room } from "../room";
import { RoomRegistry } from "../room-registry";
import { PUBLIC_ROOMS } from "../rooms";
import { createMediaFeature } from "./media";
import { loadMediaCatalogue } from "./media-catalogue";
import { SHELF_EPOCH, shelfAt } from "./media-playlist";

const items: MediaItem[] = [
  { id: "one", title: "One", year: 1900, silent: true, durationSeconds: 10, licence: "PD" },
  { id: "two", title: "Two", year: 1900, silent: false, durationSeconds: 20.125, licence: "PD" },
];
const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const spec = PUBLIC_ROOMS[0];
if (!spec) throw new Error("no room");
function socket() {
  const sent: ServerMessage[] = [];
  return { sent, send: (raw: string) => sent.push(JSON.parse(raw)) };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("house shelf scheduling", () => {
  it("advances exactly on durations, loops and skips missed ticks without accumulating drift", () => {
    expect(shelfAt(items, SHELF_EPOCH)).toEqual({ itemId: "one", startedAt: SHELF_EPOCH });
    expect(shelfAt(items, SHELF_EPOCH + 9_999).itemId).toBe("one");
    expect(shelfAt(items, SHELF_EPOCH + 10_000)).toEqual({
      itemId: "two",
      startedAt: SHELF_EPOCH + 10_000,
    });
    expect(shelfAt(items, SHELF_EPOCH + 30_125)).toEqual({
      itemId: "one",
      startedAt: SHELF_EPOCH + 30_125,
    });
    expect(shelfAt(items, SHELF_EPOCH + 30_125 * 500 + 11_000)).toEqual({
      itemId: "two",
      startedAt: SHELF_EPOCH + 30_125 * 500 + 10_000,
    });
  });

  it("handles empty catalogues and rejects invalid durations", () => {
    expect(shelfAt([], 123)).toEqual({ itemId: null, startedAt: 0 });
    expect(() => shelfAt([{ ...(items[0] as MediaItem), durationSeconds: 0 }], 0)).toThrow();
  });

  it("joins mid-film, survives restart, broadcasts only changed snapshots and samples the clock", () => {
    vi.spyOn(Date, "now").mockReturnValue(SHELF_EPOCH + 12_000);
    const create = () => createMediaFeature(items);
    const room = new Room(spec, [create]);
    const first = socket();
    room.join("a", "a", LOOK, first);
    const welcome = first.sent.find((message) => message.t === "welcome");
    expect(welcome).toMatchObject({
      media: { itemId: "two", startedAt: SHELF_EPOCH + 10_000 },
      mediaCatalogue: items,
      mediaServerNow: SHELF_EPOCH + 12_000,
    });
    const restarted = new Room(spec, [create]);
    const second = socket();
    restarted.join("b", "b", LOOK, second);
    expect(second.sent[0]).toMatchObject({
      media: welcome?.t === "welcome" ? welcome.media : null,
    });
    first.sent.length = 0;
    room.tick(SHELF_EPOCH + 12_500);
    expect(first.sent).toHaveLength(0);
    room.tick(SHELF_EPOCH + 31_000);
    expect(first.sent).toEqual([
      {
        t: "media",
        media: { itemId: "one", startedAt: SHELF_EPOCH + 30_125 },
        serverNow: SHELF_EPOCH + 31_000,
      },
    ]);
    vi.mocked(Date.now).mockReturnValue(SHELF_EPOCH + 32_000);
    room.handleMessage("a", { t: "mediaSync", sentAt: 77 }, first);
    expect(first.sent.at(-1)).toMatchObject({
      t: "media",
      sentAt: 77,
      serverNow: SHELF_EPOCH + 32_000,
    });
    const count = first.sent.length;
    room.handleMessage("a", { t: "mediaSync", sentAt: Number.NaN }, first);
    expect(first.sent).toHaveLength(count);
  });

  it("publishes only the five mirror metadata entries, not source URLs or filesystem paths", () => {
    const MEDIA_CATALOGUE = loadMediaCatalogue();
    expect(MEDIA_CATALOGUE).toHaveLength(5);
    expect(MEDIA_CATALOGUE.some((item) => !item.silent)).toBe(true);
    expect(JSON.stringify(MEDIA_CATALOGUE)).not.toMatch(/sourceUrl|sourceFile|upload.wikimedia/);
    expect(MEDIA_CATALOGUE.find((item) => item.id === "spring")?.attribution).toContain(
      "CC BY 4.0",
    );
  });

  it("switches exactly at a film boundary without waiting for a room tick, with no duplicate tick broadcast", () => {
    vi.useFakeTimers();
    vi.setSystemTime(SHELF_EPOCH + 9_000);
    const room = new Room(spec, [() => createMediaFeature(items)]);
    const first = socket();
    room.join("a", "a", LOOK, first);
    first.sent.length = 0;
    vi.advanceTimersByTime(999);
    expect(first.sent).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(first.sent).toEqual([
      {
        t: "media",
        media: { itemId: "two", startedAt: SHELF_EPOCH + 10_000 },
        serverNow: SHELF_EPOCH + 10_000,
      },
    ]);
    room.tick();
    expect(first.sent).toHaveLength(1);
    vi.advanceTimersByTime(20_125);
    expect(first.sent.at(-1)).toMatchObject({
      media: { itemId: "one", startedAt: SHELF_EPOCH + 30_125 },
    });
    room.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears boundary timers on teardown, does not arm empty rooms, and retains the tick as a backstop", () => {
    vi.useFakeTimers();
    vi.setSystemTime(SHELF_EPOCH + 9_000);
    const room = new Room(spec, [() => createMediaFeature(items)]);
    room.tick();
    expect(vi.getTimerCount()).toBe(0);
    const first = socket();
    room.join("a", "a", LOOK, first);
    expect(vi.getTimerCount()).toBe(1);
    vi.clearAllTimers(); // Simulate an unavailable/delayed timer; state still catches up on tick.
    vi.setSystemTime(SHELF_EPOCH + 31_000);
    room.tick();
    expect(first.sent.at(-1)).toMatchObject({
      media: { itemId: "one", startedAt: SHELF_EPOCH + 30_125 },
    });
    expect(vi.getTimerCount()).toBe(1);
    room.destroy();
    room.destroy();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    room.tick();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels the boundary timer on last eviction but not a transient disconnect", () => {
    vi.useFakeTimers();
    vi.setSystemTime(SHELF_EPOCH + 9_000);
    const room = new Room(spec, [() => createMediaFeature(items)]);
    room.join("a", "a", LOOK, socket());
    room.disconnect("a");
    expect(vi.getTimerCount()).toBe(1);
    room.tick(SHELF_EPOCH + 130_000);
    expect(room.occupants).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    room.destroy();
  });

  it("gives private rooms independent media instances and clears only the destroyed room's timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(SHELF_EPOCH + 9_000);
    const codes = ["amber-apple-arch", "cedar-chalk-cherry"];
    const registry = new RoomRegistry(() => codes.shift() ?? "dawn-dimple-dolphin");
    const first = registry.createPrivateRoom();
    const second = registry.createPrivateRoom();
    const firstRoom = registry.get(first.roomId);
    const secondRoom = registry.get(second.roomId);
    if (!firstRoom || !secondRoom) throw new Error("private rooms were not created");
    const firstSocket = socket();
    const secondSocket = socket();
    firstRoom.join("a", "ada", LOOK, firstSocket);
    secondRoom.join("b", "bo", LOOK, secondSocket);
    expect(vi.getTimerCount()).toBe(2);
    const firstWelcome = firstSocket.sent.find((message) => message.t === "welcome");
    const secondWelcome = secondSocket.sent.find((message) => message.t === "welcome");
    expect(firstWelcome).toMatchObject({
      media: secondWelcome?.t === "welcome" ? secondWelcome.media : null,
    });
    expect(registry.destroyPrivateRoom(first.roomId)).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    expect(firstRoom.occupants).toEqual([]);
    firstSocket.sent.length = 0;
    secondSocket.sent.length = 0;
    vi.advanceTimersByTime(503_000);
    expect(firstSocket.sent).toEqual([]);
    expect(secondSocket.sent.some((message) => message.t === "media")).toBe(true);
    expect(registry.getByCode(second.code)).toBe(secondRoom);
    expect(vi.getTimerCount()).toBe(1);
    registry.destroyPrivateRoom(second.roomId);
    expect(vi.getTimerCount()).toBe(0);
  });
});
