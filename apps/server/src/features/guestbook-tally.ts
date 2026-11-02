/** Milliseconds in one hour. */
export const HOUR_MS = 3_600_000;

/** A completed or in-progress tally for one night. */
export interface NightTally {
  /** Distinct occupants who fell asleep that night. */
  sleepers: number;
  /** Total hours slept that night, fractional. */
  sleeperHours: number;
}

/**
 * The key of a night, derived from the server's local calendar date at `at`.
 * A "night" runs from one local midnight to the next; this key is the date of
 * the midnight that *starts* the night. So "last night" at 2026-11-03 07:00 is
 * `2026-11-02`.
 */
export function nightKey(at: number): string {
  const d = new Date(at);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

interface NightAcc {
  /** Distinct sleeper ids observed this session (for dedup only, never persisted). */
  ids: Set<string>;
  /** Sum of closed-episode hours observed this session. */
  closedHours: number;
  /** Persisted baseline (count + hours) folded in at boot, before any id was known. */
  baseline?: NightTally;
}

/**
 * Accumulates per-night sleep tallies in memory.
 *
 * An episode starts when an occupant falls asleep and is attributed *entirely*
 * to the night it started in, so a sleep spanning local midnight counts wholly
 * for the night it began. "Distinct sleepers" is per process lifetime: occupant
 * ids are server-assigned per connection, so a restart cannot double-count
 * within a session, and a night's pre-restart tally is folded back in through
 * {@link seed}. The id sets are dropped when the process ends; they are never
 * persisted.
 */
export class GuestbookTally {
  private readonly open = new Map<string, { start: number; night: string }>();
  private readonly nights = new Map<string, NightAcc>();

  /** Fold in a persisted baseline for a night (a count and hours, no ids). */
  seed(night: string, tally: NightTally): void {
    this.acc(night).baseline = tally;
  }

  /** Record that `id` fell asleep at `at`. Idempotent while already asleep. */
  asleep(id: string, at: number): void {
    if (this.open.has(id)) return;
    const night = nightKey(at);
    this.open.set(id, { start: at, night });
    this.acc(night).ids.add(id);
  }

  /** Close `id`'s episode at `at` (they woke), adding its hours to its night. */
  awake(id: string, at: number): void {
    this.close(id, at);
  }

  /** Close `id`'s episode at `at` (they left while asleep). */
  leave(id: string, at: number): void {
    this.close(id, at);
  }

  /**
   * Tally for a night: closed hours plus the partial hours of still-open
   * episodes, folded over any seeded baseline.
   */
  tally(night: string, at: number): NightTally {
    const acc = this.nights.get(night);
    let hours = acc?.closedHours ?? 0;
    for (const episode of this.open.values()) {
      if (episode.night === night) hours += (at - episode.start) / HOUR_MS;
    }
    const base = acc?.baseline;
    return {
      sleepers: (acc?.ids.size ?? 0) + (base?.sleepers ?? 0),
      sleeperHours: round(hours + (base?.sleeperHours ?? 0)),
    };
  }

  /** Night keys that currently carry data, oldest first. */
  nightsWithData(): string[] {
    return [...this.nights.keys()].sort();
  }

  /** True while at least one occupant is mid-sleep (partial hours still accruing). */
  hasOpenEpisodes(): boolean {
    return this.open.size > 0;
  }

  private close(id: string, at: number): void {
    const episode = this.open.get(id);
    if (!episode) return;
    this.acc(episode.night).closedHours += Math.max(0, at - episode.start) / HOUR_MS;
    this.open.delete(id);
  }

  private acc(night: string): NightAcc {
    let acc = this.nights.get(night);
    if (!acc) {
      acc = { ids: new Set(), closedHours: 0 };
      this.nights.set(night, acc);
    }
    return acc;
  }
}

/** Two decimal places keeps the wire and the table tidy. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
