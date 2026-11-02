import type { GuestbookEntry } from "@dormouse/protocol";
import type { Room } from "../room";
import { PUBLIC_ROOMS } from "../rooms";
import type { RoomFeature } from "./feature";
import { type GuestbookStore, getDefaultGuestbookStore } from "./guestbook-store";
import { GuestbookTally, nightKey, previousNightKey } from "./guestbook-tally";

/** How many recent nights to keep in the welcome snapshot and the table list. */
const RECENT_NIGHTS = 7;
/** Flush a dirty tally this often, so a crash loses at most this much. */
const FLUSH_INTERVAL_MS = 30_000;

/** Only public rooms carry a tally; private rooms are ephemeral and code-protected. */
const PUBLIC_ROOM_IDS = new Set(PUBLIC_ROOMS.map((room) => room.id));

/**
 * The guestbook: count who slept here each night and survive restarts.
 *
 * All database I/O is fire-and-forget and error-handled; no room hook blocks
 * on it. The tally is kept in memory and flushed to Postgres (or a memory
 * fallback) on change and on a timer, then finalized nights are pruned from
 * memory. Because the welcome hook is synchronous it serves whatever is cached
 * so far; once the store finishes loading (or a night rolls over) a `guestbook`
 * push carries the freshest snapshot to anyone already connected.
 *
 * Private rooms are excluded: they are ephemeral and code-protected, so there
 * is no meaningful "who slept here last night" to remember for them.
 */
export function createGuestbookFeature(
  store: GuestbookStore = getDefaultGuestbookStore(),
  now: () => number = () => Date.now(),
): RoomFeature {
  const tally = new GuestbookTally();
  const lastAsleep = new Map<string, boolean>();
  let entries: GuestbookEntry[] = [];
  let lastNight = "";
  let roomId: string | null = null;
  let roomRef: Room | null = null;
  let currentNight = "";
  let lastFlushAt = -Infinity;
  let dirty = false;
  let failed = false;
  let destroyed = false;
  let ready: Promise<void> = Promise.resolve();

  void store.init();

  function warn(error: unknown, context: string): void {
    if (failed) return;
    failed = true;
    console.warn(`guestbook: ${context}`, error);
  }

  /** Adopt a fresher snapshot and tell anyone already connected. */
  function pushIfChanged(next: GuestbookEntry[], nextLastNight: string): void {
    const changed = nextLastNight !== lastNight || JSON.stringify(next) !== JSON.stringify(entries);
    if (!changed) return;
    entries = next;
    lastNight = nextLastNight;
    roomRef?.broadcast({ t: "guestbook", guestbook: entries, lastNight });
  }

  function start(room: Room): void {
    if (destroyed || roomId !== null) return;
    roomId = room.spec.id;
    roomRef = room;
    currentNight = nightKey(now());
    ready = (async () => {
      const id = roomId;
      if (id === null) return;
      await store.init();
      const nights = await store.list(id, RECENT_NIGHTS);
      const key = nightKey(now());
      const current = nights.find((n) => n.date === key);
      if (current) tally.seed(key, current);
      pushIfChanged(
        nights.filter((n) => n.date < key),
        previousNightKey(now()),
      );
    })().catch((error) => warn(error, "failed to load recent nights"));
  }

  async function refreshEntries(): Promise<void> {
    const id = roomId;
    if (id === null) return;
    const key = nightKey(now());
    const nights = await store.list(id, RECENT_NIGHTS);
    pushIfChanged(
      nights.filter((n) => n.date < key),
      previousNightKey(now()),
    );
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
      // Only after every night was saved: finalized nights can leave memory.
      tally.pruneFinalized(nightKey(at));
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
      if (!PUBLIC_ROOM_IDS.has(room.spec.id)) return;
      start(room);
      lastAsleep.set(occupant.id, occupant.asleep);
    },
    onLeave(room, occupant) {
      if (!PUBLIC_ROOM_IDS.has(room.spec.id)) return;
      start(room);
      lastAsleep.delete(occupant.id);
      if (occupant.asleep) {
        tally.leave(occupant.id, now());
        dirty = true;
      }
    },
    onTick(room, at) {
      if (!PUBLIC_ROOM_IDS.has(room.spec.id)) return;
      start(room);
      observe(room, at);
      maybeFlush(at);
    },
    welcome(room) {
      if (!PUBLIC_ROOM_IDS.has(room.spec.id)) return { guestbook: [], lastNight: "" };
      start(room);
      return { guestbook: entries, lastNight };
    },
    destroy() {
      // Final best-effort flush of any un-persisted tally, then drop the room
      // reference so a late load/refresh cannot broadcast to a retired room.
      destroyed = true;
      if (roomId !== null) void flush(now());
      roomId = null;
      roomRef = null;
    },
  };
}
