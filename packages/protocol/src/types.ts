/** How a body is arranged. Seats declare which poses they permit. */
export type Pose = "stand" | "sit" | "lie";

export interface Seat {
  id: string;
  kind: "couch" | "beanbag" | "hammock";
  pose: Pose;
  /** Scene coordinates, in room-space pixels. */
  x: number;
  y: number;
  depth: number;
}

export interface RoomSpec {
  id: string;
  name: string;
  seats: Seat[];
  capacity: number;
  /** Versioned directory under the pack base URL. Absent means placeholder art. */
  packId?: string;
}

export interface Occupant {
  id: string;
  name: string;
  seatId: string | null;
  /** Cosmetic -- it restricts nothing. */
  asleep: boolean;
  look: AvatarLook;
}

/** Palette indices into the avatar layer sets.
 * TODO(#38): v0.1 per-seat sprites use an id-derived catalogue look; restore layered customisation later.
 */
export interface AvatarLook {
  tone: number;
  head: number;
  top: number;
  accessory: number;
}
