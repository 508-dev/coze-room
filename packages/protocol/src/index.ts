/** Composable wire contract. Feature messages live beside this registry. */
export type { GuestbookEntry, GuestbookWelcome } from "./guestbook";
export type { MediaState, MediaWelcome } from "./media";
export type { WelcomeFields, WelcomeMessage } from "./presence";
export type { AvatarLook, Occupant, Pose, RoomSpec, Seat } from "./types";

export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | import("./presence").PresenceClientMessage
  | import("./seating").SeatingClientMessage;

export type ServerMessage =
  | import("./presence").PresenceServerMessage
  | import("./seating").SeatingServerMessage
  | import("./media").MediaServerMessage;

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
