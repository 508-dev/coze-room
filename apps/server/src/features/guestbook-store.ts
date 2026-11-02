import type { GuestbookEntry } from "@dormouse/protocol";
// Type-only so vitest (node environment) never has to resolve the Bun builtin;
// the client is imported lazily inside `connect` and only runs under Bun.
import type { SQL } from "bun";
import type { NightTally } from "./guestbook-tally";

/** Persistence for nightly tallies. Implementations never throw from `init`. */
export interface GuestbookStore {
  /** Connect and migrate, or give up and run in memory. Resolves either way. */
  init(): Promise<void>;
  /** Upsert one night's tally. */
  save(roomId: string, night: string, tally: NightTally): Promise<void>;
  /** Recent nights for a room, newest first. */
  list(roomId: string, limit: number): Promise<GuestbookEntry[]>;
}

const rowKey = (roomId: string, night: string): string => `${roomId}\u0000${night}`;

/** The fallback that keeps the room up when Postgres is absent or unreachable. */
export class MemoryGuestbookStore implements GuestbookStore {
  private readonly rows = new Map<string, GuestbookEntry>();

  init(): Promise<void> {
    return Promise.resolve();
  }

  async save(roomId: string, night: string, tally: NightTally): Promise<void> {
    this.rows.set(rowKey(roomId, night), {
      date: night,
      sleepers: tally.sleepers,
      sleeperHours: tally.sleeperHours,
    });
  }

  async list(roomId: string, limit: number): Promise<GuestbookEntry[]> {
    const prefix = `${roomId}\u0000`;
    const entries = [...this.rows.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, entry]) => entry)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return entries.slice(0, limit);
  }
}

/** Bun's built-in Postgres client. No new dependency. */
export class PostgresGuestbookStore implements GuestbookStore {
  private db: SQL | null = null;
  private readonly ready: Promise<void>;
  private readonly memory = new MemoryGuestbookStore();
  private warned = false;

  constructor(private readonly url: string) {
    this.ready = this.connect();
  }

  init(): Promise<void> {
    return this.ready;
  }

  async save(roomId: string, night: string, tally: NightTally): Promise<void> {
    await this.ready;
    if (!this.db) return this.memory.save(roomId, night, tally);
    await this.db`
      INSERT INTO guestbook_tally (room_id, night, sleepers, sleeper_hours)
      VALUES (${roomId}, ${night}, ${tally.sleepers}, ${tally.sleeperHours})
      ON CONFLICT (room_id, night)
      DO UPDATE SET sleepers = EXCLUDED.sleepers, sleeper_hours = EXCLUDED.sleeper_hours
    `;
  }

  async list(roomId: string, limit: number): Promise<GuestbookEntry[]> {
    await this.ready;
    if (!this.db) return this.memory.list(roomId, limit);
    const rows = await this.db<{ night: string; sleepers: number; sleeper_hours: number }[]>`
      SELECT night, sleepers, sleeper_hours
      FROM guestbook_tally
      WHERE room_id = ${roomId}
      ORDER BY night DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      date: row.night,
      sleepers: row.sleepers,
      sleeperHours: row.sleeper_hours,
    }));
  }

  /** Idempotent, tiny migration + a first connection to prove reachability. */
  private async connect(): Promise<void> {
    try {
      const { SQL: SQLClient } = await import("bun");
      const db = new SQLClient(this.url, { connectionTimeout: 5, max: 3 });
      await db`
        CREATE TABLE IF NOT EXISTS guestbook_tally (
          room_id TEXT NOT NULL,
          night TEXT NOT NULL,
          sleepers INTEGER NOT NULL,
          sleeper_hours DOUBLE PRECISION NOT NULL,
          PRIMARY KEY (room_id, night)
        )
      `;
      this.db = db;
    } catch (error) {
      this.warnOnce(`guestbook: Postgres unavailable; running in memory (${describe(error)})`);
    }
  }

  private warnOnce(message: string): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(message);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pick a store from the environment. A missing `DATABASE_URL` falls back to
 * memory and logs once, so the room never fails to start because of this.
 */
export function createGuestbookStore(env: NodeJS.ProcessEnv = process.env): GuestbookStore {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    console.warn("guestbook: DATABASE_URL unset; running in memory");
    return new MemoryGuestbookStore();
  }
  return new PostgresGuestbookStore(url);
}

/** One store per process. The migration runs once, not once per room. */
let defaultStore: GuestbookStore | undefined;

export function getDefaultGuestbookStore(): GuestbookStore {
  defaultStore ??= createGuestbookStore();
  return defaultStore;
}
