import type { RoomSpec } from "@dormouse/protocol";

/**
 * Public rooms are a small fixed set of named places, not user-created lobbies.
 * A short list concentrates the population so rooms are actually occupied, and
 * it bounds the moderation surface to somewhere we can watch.
 *
 * v0.1 ships one. Seats are data: adding furniture is an edit here, not code.
 */
export const PUBLIC_ROOMS: RoomSpec[] = [
  {
    id: "the-back-room",
    name: "The Back Room",
    capacity: 12,
    seats: [
      { id: "couch-l", kind: "couch", pose: "sit", x: 180, y: 300, depth: 2 },
      { id: "couch-r", kind: "couch", pose: "sit", x: 250, y: 300, depth: 2 },
      { id: "beanbag", kind: "beanbag", pose: "sit", x: 380, y: 340, depth: 3 },
      { id: "hammock", kind: "hammock", pose: "lie", x: 480, y: 250, depth: 1 },
    ],
  },
];

export const findRoom = (id: string): RoomSpec | undefined => PUBLIC_ROOMS.find((r) => r.id === id);
