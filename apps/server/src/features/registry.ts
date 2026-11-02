import type { RoomFeatureFactory } from "./feature";
import { createGuestbookFeature } from "./guestbook";
import { createMediaFeature } from "./media";
import { createPresenceFeature } from "./presence";
import { createSeatingFeature } from "./seating";

/** Add one factory here. Never share mutable feature state between rooms. */
export const roomFeatures: readonly RoomFeatureFactory[] = [
  createPresenceFeature,
  createSeatingFeature,
  createMediaFeature,
  createGuestbookFeature,
];
