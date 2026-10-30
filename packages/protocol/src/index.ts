/**
 * The wire contract between client and server.
 *
 * Deliberately small. The room carries very little state: who is here, where
 * they are sitting, whether they have drifted off, and what the TV is playing.
 * A busy room generates well under one message per second, so there is no
 * binary encoding and no tick loop -- events are sent when something happens.
 */

export const PROTOCOL_VERSION = 1;

/** How a body is arranged. Seats declare which poses they permit. */
export type Pose = "stand" | "sit" | "lie";

/** Seats are furniture. A room's capacity for *sitting* is its seat list. */
export interface Seat {
  id: string;
  kind: "couch" | "beanbag" | "hammock";
  pose: Pose;
  /** Scene coordinates, in room-space pixels. */
  x: number;
  y: number;
  /** Draw order against other room furniture. */
  depth: number;
}

export interface RoomSpec {
  id: string;
  name: string;
  seats: Seat[];
  /** Hard cap on bodies in the room, independent of seat count. */
  capacity: number;
}

export interface Occupant {
  id: string;
  name: string;
  /** Null means standing somewhere unremarkable. */
  seatId: string | null;
  /** Set after the idle threshold. Cosmetic -- it restricts nothing. */
  asleep: boolean;
  /** Palette indices into the avatar layer sets. */
  look: AvatarLook;
}

export interface AvatarLook {
  tone: number;
  head: number;
  top: number;
  accessory: number;
}

/** What the TV is doing. Sync is a start timestamp and nothing else. */
export interface MediaState {
  itemId: string | null;
  /** Server wall-clock ms at which playback began. Clients seek to now - this. */
  startedAt: number;
}

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { t: "join"; name: string; look: AvatarLook }
  | { t: "takeSeat"; seatId: string }
  | { t: "stand" }
  | { t: "awake" }
  | { t: "pong" };

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export type ServerMessage =
  | {
      t: "welcome";
      protocol: number;
      selfId: string;
      room: RoomSpec;
      occupants: Occupant[];
      media: MediaState;
      /** Sleeper-hours and headcount from previous nights, for the trace board. */
      traces: NightTrace[];
    }
  | { t: "joined"; occupant: Occupant }
  | { t: "left"; id: string }
  | { t: "moved"; id: string; seatId: string | null }
  | { t: "dozed"; id: string; asleep: boolean }
  | { t: "media"; media: MediaState }
  | { t: "full"; occupants: Occupant[] }
  | { t: "ping" };

export interface NightTrace {
  /** ISO date of the night, keyed to local server midnight. */
  date: string;
  sleepers: number;
  sleeperHours: number;
}

export const encode = (m: ServerMessage | ClientMessage): string => JSON.stringify(m);

export function decode<T extends ServerMessage | ClientMessage>(raw: string): T | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "t" in parsed) return parsed as T;
    return null;
  } catch {
    return null;
  }
}
