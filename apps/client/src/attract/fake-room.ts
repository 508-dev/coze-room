import type { Occupant, RoomSpec } from "@dormouse/protocol";

export const ATTRACT_LOOP_MS = 36_000;

/** A local room specification: no connection, server state, names or presence counts. */
export const ATTRACT_ROOM: RoomSpec = {
  id: "attract-backdrop",
  name: "",
  capacity: 3,
  seats: [
    { id: "couch-l", kind: "couch", pose: "sit", x: 180, y: 300, depth: 2 },
    { id: "couch-r", kind: "couch", pose: "sit", x: 250, y: 300, depth: 2 },
    { id: "beanbag", kind: "beanbag", pose: "sit", x: 380, y: 340, depth: 3 },
    { id: "hammock", kind: "hammock", pose: "lie", x: 480, y: 250, depth: 1 },
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
