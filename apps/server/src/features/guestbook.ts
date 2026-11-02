import type { GuestbookEntry } from "@dormouse/protocol";
import type { Room } from "../room";
import type { RoomFeature } from "./feature";
import { type GuestbookStore, getDefaultGuestbookStore } from "./guestbook-store";
import { GuestbookTally, nightKey } from "./guestbook-tally";

/** How many recent nights to keep in the welcome snapshot and the table list. */
const RECENT_NIGHTS = 7;
/** Flush a dirty tally this often, so a crash loses at most this much. */
const FLUSH_INTERVAL_MS = 30_000;

/**
 * The guestbook: count who slept here each night and survive restarts.
 *
 * All database I/O is fire-and-forget and error-handled; no room hook blocks
 * on it. The tally is kept in memory and flushed to Postgres (or a memory
 * fallback) on change and on a timer. The welcome hook serves the last few
 * *completed* nights from a cached list, so it stays synchronous.
 */
export function createGuestbookFeature(
  store: GuestbookStore = getDefaultGuestbookStore(),
  now: () => number = () => Date.now(),
): RoomFeature {
  const tally = new GuestbookTally();
  let entries: GuestbookEntry[] = [];
  const lastAsleep = new Map<string, boolean>();
  let roomId: string | null = null;
  let currentNight = "";
  let lastFlushAt = -Infinity;
  let dirty = false;
  let failed = false;
  let ready: Promise<void> = Promise.resolve();

  void store.init();

  function warn(error: unknown, context: string): void {
    if (failed) return;
    failed = true;
    console.warn(`guestbook: ${context}`, error);
  }

  function start(room: Room): void {
    if (roomId !== null) return;
    roomId = room.spec.id;
    currentNight = nightKey(now());
    ready = (async () => {
      const id = roomId;
      if (id === null) return;
      await store.init();
      const nights = await store.list(id, RECENT_NIGHTS);
      const key = nightKey(now());
      const current = nights.find((n) => n.date === key);
      if (current) tally.seed(key, current);
      entries = nights.filter((n) => n.date < key);
    })().catch((error) => warn(error, "failed to load recent nights"));
  }

  async function refreshEntries(): Promise<void> {
    const id = roomId;
    if (id === null) return;
    const key = nightKey(now());
    const nights = await store.list(id, RECENT_NIGHTS);
    entries = nights.filter((n) => n.date < key);
  }

  async function flush(at: number): Promise<void> {
    const id = roomId;
    if (id === null) return;
    await ready;
    try {
      for (const night of tally.nightsWithData()) {
        await store.save(id, night, tally.tally(night, at));
      }
      await refreshEntries();
    } catch (error) {
      warn(error, "flush failed");
    }
  }

  function maybeFlush(at: number): void {
    const key = nightKey(at);
    const rolled = key !== currentNight;
    currentNight = key;
    const due = at - lastFlushAt >= FLUSH_INTERVAL_MS;
    // Flush on a night boundary, on a recent change, and periodically while
    // anyone is still asleep so partial hours survive a crash.
    if (rolled || ((dirty || tally.hasOpenEpisodes()) && due)) {
      lastFlushAt = at;
      dirty = false;
      void flush(at);
    }
  }

  function observe(room: Room, at: number): void {
    const present = new Set<string>();
    for (const occupant of room.occupants) {
      present.add(occupant.id);
      const prev = lastAsleep.get(occupant.id);
      if (occupant.asleep && prev === false) {
        tally.asleep(occupant.id, at);
        dirty = true;
      } else if (!occupant.asleep && prev === true) {
        tally.awake(occupant.id, at);
        dirty = true;
      }
      lastAsleep.set(occupant.id, occupant.asleep);
    }
    for (const id of lastAsleep.keys()) {
      if (!present.has(id)) lastAsleep.delete(id);
    }
  }

  return {
    onJoin(room, occupant) {
      start(room);
      lastAsleep.set(occupant.id, occupant.asleep);
    },
    onLeave(room, occupant) {
      start(room);
      lastAsleep.delete(occupant.id);
      if (occupant.asleep) {
        tally.leave(occupant.id, now());
        dirty = true;
      }
    },
    onTick(room, at) {
      start(room);
      observe(room, at);
      maybeFlush(at);
    },
    welcome(room) {
      start(room);
      return { guestbook: entries };
    },
  };
}
