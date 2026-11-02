import type { GuestbookEntry, Occupant } from "@dormouse/protocol";

/**
 * Display names of the occupants still asleep when `selfId` wakes, excluding
 * self. This is the wake-summary payoff: a quiet "you slept beside ..." line.
 * Pure so it is testable without the feature's runes or a connection.
 */
export function companionsAtWake(occupants: Occupant[], selfId: string, max = 3): string[] {
  return occupants
    .filter((o) => o.id !== selfId && o.asleep)
    .map((o) => o.name)
    .slice(0, max);
}

/** "ada", "ada and bo", or "ada, bo, and cy" for a handful of names. */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The sleeper count for the server's "last night", looked up by calendar date
 * rather than array position. Returns `null` before any snapshot has arrived
 * (`lastNight` is empty), and `0` when last night had no sleepers — never an
 * older night's count.
 */
export function lastNightSleepers(entries: GuestbookEntry[], lastNight: string): number | null {
  if (!lastNight) return null;
  return entries.find((entry) => entry.date === lastNight)?.sleepers ?? 0;
}
