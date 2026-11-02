import type { AvatarLook, Occupant, ServerMessage } from "@dormouse/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Room } from "../room";
import { PUBLIC_ROOMS } from "../rooms";
import { createGuestbookFeature } from "./guestbook";
import { createGuestbookStore, MemoryGuestbookStore } from "./guestbook-store";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const spec = PUBLIC_ROOMS[0];
if (!spec) throw new Error("no public room");

const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function recorder() {
  const sent: ServerMessage[] = [];
  return { sent, socket: { send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage) } };
}

/** A room-shaped stand-in with controllable occupants; the feature only reads spec + occupants. */
function roomWith(occupants: Occupant[]): Room {
  return { spec, occupants } as unknown as Room;
}

function occupant(id: string, asleep: boolean): Occupant {
  return { id, name: id, seatId: null, asleep, look: LOOK };
}

/** Let fire-and-forget async in the feature settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => vi.restoreAllMocks());

describe("MemoryGuestbookStore", () => {
  it("round-trips tallies and returns recent nights newest-first, limited", async () => {
    const store = new MemoryGuestbookStore();
    await store.save("the-back-room", "2026-11-01", { sleepers: 12, sleeperHours: 30 });
    await store.save("the-back-room", "2026-11-02", { sleepers: 8, sleeperHours: 21 });
    await store.save("the-back-room", "2026-11-03", { sleepers: 2, sleeperHours: 3 });

    expect(await store.list("the-back-room", 2)).toEqual([
      { date: "2026-11-03", sleepers: 2, sleeperHours: 3 },
      { date: "2026-11-02", sleepers: 8, sleeperHours: 21 },
    ]);
  });

  it("does not leak one room's tallies into another", async () => {
    const store = new MemoryGuestbookStore();
    await store.save("a", "2026-11-01", { sleepers: 1, sleeperHours: 1 });
    await store.save("b", "2026-11-01", { sleepers: 9, sleeperHours: 9 });
    expect(await store.list("a", 10)).toEqual([
      { date: "2026-11-01", sleepers: 1, sleeperHours: 1 },
    ]);
  });
});

describe("guestbook store selection", () => {
  it("falls back to memory when DATABASE_URL is unset, logging once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createGuestbookStore({});
    expect(store).toBeInstanceOf(MemoryGuestbookStore);
    await store.init();
    await store.save("r", "2026-11-01", { sleepers: 1, sleeperHours: 1 });
    expect(await store.list("r", 10)).toHaveLength(1);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "guestbook: DATABASE_URL unset; running in memory",
    );
  });
});

describe("guestbook feature", () => {
  it("serves recent completed nights in the welcome snapshot, newest first", async () => {
    const store = new MemoryGuestbookStore();
    await store.save("the-back-room", "2026-11-01", { sleepers: 12, sleeperHours: 30 });
    await store.save("the-back-room", "2026-11-02", { sleepers: 8, sleeperHours: 21 });
    await store.save("the-back-room", "2026-11-03", { sleepers: 2, sleeperHours: 3 });

    // Morning of 11-03: that night is in progress, so only earlier nights show.
    const feature = createGuestbookFeature(store, () => local(2026, 11, 3, 7, 0));
    const room = new Room(spec, [() => feature]);
    room.join("a", "ada", LOOK, recorder().socket);
    await settle();

    const socket = recorder();
    room.join("b", "bo", LOOK, socket.socket);
    const welcome = socket.sent.find((m) => m.t === "welcome");
    expect(welcome).toMatchObject({
      guestbook: [
        { date: "2026-11-02", sleepers: 8, sleeperHours: 21 },
        { date: "2026-11-01", sleepers: 12, sleeperHours: 30 },
      ],
    });
  });

  it("tallies a sleeper and persists it to the store", async () => {
    const store = new MemoryGuestbookStore();
    let clock = local(2026, 11, 2, 22, 0);
    const now = () => clock;
    const feature = createGuestbookFeature(store, now);

    const a = occupant("a", false);
    const room = roomWith([a]);
    feature.onJoin?.(room, a);
    await settle();

    a.asleep = true;
    clock = local(2026, 11, 2, 22, 11);
    feature.onTick?.(room, clock);
    await settle();

    expect(await store.list("the-back-room", 10)).toEqual([
      { date: "2026-11-02", sleepers: 1, sleeperHours: 0 },
    ]);
  });

  it("accumulates sleeper-hours for a sleep spanning midnight, on its start night", async () => {
    const store = new MemoryGuestbookStore();
    let clock = local(2026, 11, 2, 23, 0);
    const now = () => clock;
    const feature = createGuestbookFeature(store, now);

    const a = occupant("a", false);
    const room = roomWith([a]);
    feature.onJoin?.(room, a);
    await settle();

    a.asleep = true;
    clock = local(2026, 11, 2, 23, 10);
    feature.onTick?.(room, clock);
    await settle();

    // Still asleep an hour later, across local midnight: the whole hour is 11-02's.
    clock = local(2026, 11, 3, 0, 10);
    feature.onTick?.(room, clock);
    await settle();

    expect(await store.list("the-back-room", 10)).toEqual([
      { date: "2026-11-02", sleepers: 1, sleeperHours: 1 },
    ]);
  });

  it("keeps the room starting even with no database configured", () => {
    const store = new MemoryGuestbookStore();
    const feature = createGuestbookFeature(store, () => local(2026, 11, 3, 7, 0));
    const room = new Room(spec, [() => feature]);
    const socket = recorder();
    expect(() => room.join("a", "ada", LOOK, socket.socket)).not.toThrow();
    expect(room.occupants).toHaveLength(1);
  });
});
