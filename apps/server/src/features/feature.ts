import type { ClientMessage, Occupant, WelcomeFields } from "@dormouse/protocol";
import type { Room } from "../room";

/** A fresh instance per room. Leave means eviction, not a temporary wifi drop. */
export interface RoomFeature {
  onJoin?(room: Room, occupant: Occupant): void;
  onLeave?(room: Room, occupant: Occupant): void;
  /** Return true when this feature owns the message; later features won't receive it. */
  onMessage?(room: Room, id: string, message: ClientMessage): boolean | undefined;
  onTick?(room: Room, now: number): void;
  welcome?(room: Room, selfId: string): Partial<WelcomeFields>;
}

export type RoomFeatureFactory = () => RoomFeature;
