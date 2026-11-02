/** Composable wire contract. Feature messages live beside this registry. */
export type { GuestbookEntry, GuestbookWelcome } from "./guestbook";
export type { MediaItem, MediaState, MediaWelcome } from "./media";
export type { PhraseCategory, PhraseId } from "./phrases";
export { isPhraseId, PHRASE_CATEGORIES, PHRASES } from "./phrases";
export type { WelcomeFields, WelcomeMessage } from "./presence";
export {
  normalizePrivateCode,
  type PrivateRoomCreated,
  type PublicRoomSummary,
} from "./private-rooms";
export type { AvatarLook, Occupant, Pose, RoomSpec, Seat } from "./types";

export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | import("./presence").PresenceClientMessage
  | import("./media").MediaClientMessage
  | import("./seating").SeatingClientMessage
  | import("./phrases").PhrasesClientMessage;

export type ServerMessage =
  | import("./presence").PresenceServerMessage
  | import("./seating").SeatingServerMessage
  | import("./media").MediaServerMessage
  | import("./phrases").PhrasesServerMessage;

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
