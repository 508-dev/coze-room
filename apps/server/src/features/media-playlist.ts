import type { MediaItem, MediaState } from "@dormouse/protocol";

/** Stable reference: restarts and empty rooms do not restart the film. */
export const SHELF_EPOCH = Date.UTC(2026, 0, 1);

/** House strategy seam; a future user queue can replace this without changing sync. */
export function shelfAt(items: readonly MediaItem[], now: number, epoch = SHELF_EPOCH): MediaState {
  const durations = items.map((item) => Math.round(item.durationSeconds * 1000));
  if (durations.some((duration) => !Number.isSafeInteger(duration) || duration <= 0)) {
    throw new Error("Catalogue durations must be positive milliseconds");
  }
  const cycle = durations.reduce((sum, duration) => sum + duration, 0);
  if (!cycle) return { itemId: null, startedAt: 0 };
  let offset = (((now - epoch) % cycle) + cycle) % cycle;
  let startedAt = now - offset;
  for (let index = 0; index < items.length; index++) {
    const duration = durations[index];
    const item = items[index];
    if (duration === undefined || !item) continue;
    if (offset < duration) return { itemId: item.id, startedAt };
    offset -= duration;
    startedAt += duration;
  }
  throw new Error("Invalid shelf schedule");
}
