import type { EnvironmentWelcome } from "./environment";
import type { GuestbookWelcome } from "./guestbook";
import type { MediaWelcome } from "./media";
import type { AvatarLook, Occupant, RoomSpec } from "./types";

/** Add a feature's snapshot interface here; its wire fields stay at the top level. */
export interface WelcomeFields extends MediaWelcome, GuestbookWelcome, EnvironmentWelcome {}

export interface WelcomeMessage extends WelcomeFields {
  t: "welcome";
  protocol: number;
  selfId: string;
  room: RoomSpec;
  occupants: Occupant[];
}

export type PresenceClientMessage =
  | { t: "join"; name: string; look: AvatarLook }
  | { t: "awake" }
  | { t: "pong" };

export type PresenceServerMessage =
  | WelcomeMessage
  | { t: "joined"; occupant: Occupant }
  | { t: "left"; id: string }
  | { t: "dozed"; id: string; asleep: boolean }
  | { t: "full"; occupants: Occupant[] }
  | { t: "ping" };
