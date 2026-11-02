import type { RoomSpec } from "@dormouse/protocol";
import art from "../../../packs/dormouse-v0/art.json";

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
    packId: "dormouse-v0",
    seats: Object.entries(art.seats).map(([id, { anchor }]) => ({
      id,
      kind: id.startsWith("couch") ? "couch" : id === "beanbag" ? "beanbag" : "hammock",
      pose: id === "hammock" ? "lie" : "sit",
      ...anchor,
      depth: anchor.y,
    })),
  },
];
