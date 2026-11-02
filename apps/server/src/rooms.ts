import { readFileSync } from "node:fs";
import type { RoomSpec, Seat } from "@dormouse/protocol";

const PLACEHOLDER_SEATS: readonly Seat[] = [
  { id: "couch-l", kind: "couch", pose: "sit", x: 180, y: 300, depth: 2 },
  { id: "couch-r", kind: "couch", pose: "sit", x: 250, y: 300, depth: 2 },
  { id: "beanbag", kind: "beanbag", pose: "sit", x: 380, y: 340, depth: 3 },
  { id: "hammock", kind: "hammock", pose: "lie", x: 480, y: 250, depth: 1 },
];

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function artSeats(value: unknown): Seat[] {
  if (!object(value) || value.version !== 1 || !object(value.imageSize) || !object(value.seats)) {
    throw new Error("invalid art metadata");
  }
  const { width, height } = value.imageSize;
  if (
    !Number.isSafeInteger(width) ||
    Number(width) <= 0 ||
    !Number.isSafeInteger(height) ||
    Number(height) <= 0 ||
    Object.keys(value.seats).length !== PLACEHOLDER_SEATS.length
  ) {
    throw new Error("invalid art dimensions or seat count");
  }
  const seats = value.seats;
  return PLACEHOLDER_SEATS.map(({ id, kind, pose }) => {
    const seat = seats[id];
    if (!object(seat) || seat.pose !== pose || !object(seat.anchor)) {
      throw new Error(`invalid art seat: ${id}`);
    }
    const { x, y } = seat.anchor;
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      Number(x) < 0 ||
      Number(x) >= Number(width) ||
      Number(y) < 0 ||
      Number(y) >= Number(height)
    ) {
      throw new Error(`invalid art anchor: ${id}`);
    }
    return { id, kind, pose, x: Number(x), y: Number(y), depth: Number(y) };
  });
}

/** Read once at startup: a broken/missing optional pack must not stop the server. */
export function loadPublicRooms(
  artFile = new URL("../../../packs/dormouse-v0/art.json", import.meta.url),
): RoomSpec[] {
  const room: RoomSpec = {
    id: "the-back-room",
    name: "The Back Room",
    capacity: 12,
    seats: PLACEHOLDER_SEATS.map((seat) => ({ ...seat })),
  };
  try {
    room.seats = artSeats(JSON.parse(readFileSync(artFile, "utf8")));
    room.packId = "dormouse-v0";
  } catch (error) {
    console.warn("Could not load room art anchors; using placeholder room.", error);
  }
  return [room];
}

/**
 * Public rooms are a small fixed set of named places, not user-created lobbies.
 * A short list concentrates the population so rooms are actually occupied, and
 * it bounds the moderation surface to somewhere we can watch.
 *
 * v0.1 ships one. Seats are data: adding furniture is an edit here, not code.
 */
export const PUBLIC_ROOMS = loadPublicRooms();
