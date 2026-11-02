import type { Occupant, RoomSpec } from "@dormouse/protocol";

export const ATTRACT_LOOP_MS = 36_000;

/** A local room specification: no connection, server state, names or presence counts. */
export const ATTRACT_ROOM: RoomSpec = {
  id: "attract-backdrop",
  name: "",
  capacity: 3,
  packId: "dormouse-v0",
  seats: [
    { id: "couch-l", kind: "couch", pose: "sit", x: 42, y: 59, depth: 59 },
    { id: "couch-r", kind: "couch", pose: "sit", x: 65, y: 60, depth: 60 },
    { id: "beanbag", kind: "beanbag", pose: "sit", x: 18, y: 64, depth: 64 },
    { id: "hammock", kind: "hammock", pose: "lie", x: 104, y: 62, depth: 62 },
  ],
};

const CAST = [
  { id: "attract-a", seatId: "couch-l", entersAt: 0, dozesAt: 12_000 },
  { id: "attract-b", seatId: "couch-r", entersAt: 4_000, dozesAt: 20_000 },
  { id: "attract-c", seatId: "hammock", entersAt: 8_000, dozesAt: 28_000 },
] as const;

/** A deterministic, looping snapshot suitable for both the backdrop and screenshot rigs. */
export function attractOccupantsAt(elapsedMs: number): Occupant[] {
  const elapsed = Math.max(0, elapsedMs) % ATTRACT_LOOP_MS;
  return CAST.filter(({ entersAt }) => elapsed >= entersAt).map(
    ({ id, seatId, dozesAt }, index) => ({
      id,
      // The protocol requires a name, but the backdrop never displays one.
      name: "",
      seatId,
      asleep: elapsed >= dozesAt,
      look: { tone: index, head: index, top: index, accessory: 0 },
    }),
  );
}
