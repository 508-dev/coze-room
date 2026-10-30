import type {
  AvatarLook,
  GuestbookEntry,
  MediaState,
  Occupant,
  RoomSpec,
  ServerMessage,
} from "@dormouse/protocol";
import { encode } from "@dormouse/protocol";
import type { ServerWebSocket } from "bun";

/** No input for this long and the avatar visibly falls asleep. Cosmetic only. */
const DOZE_AFTER_MS = 10 * 60 * 1000;

/** A dropped connection keeps its seat this long before the body is removed. */
const RECONNECT_GRACE_MS = 2 * 60 * 1000;

export interface Socket {
  send(data: string): void;
}

interface Member {
  occupant: Occupant;
  socket: Socket | null;
  lastInput: number;
  /** Set when the socket drops; the seat is held until this fires. */
  evictAt: number | null;
}

/**
 * One room, held entirely in memory.
 *
 * At ~12 occupants and ~9 concurrent rooms there is nothing here worth putting
 * in a datastore. Rooms are recreated empty on restart, which is the correct
 * behaviour for a place people pass through overnight.
 */
export class Room {
  readonly spec: RoomSpec;
  private members = new Map<string, Member>();
  private media: MediaState = { itemId: null, startedAt: 0 };
  private guestbook: GuestbookEntry[] = [];

  constructor(spec: RoomSpec) {
    this.spec = spec;
  }

  get occupants(): Occupant[] {
    return [...this.members.values()].map((m) => m.occupant);
  }

  get isFull(): boolean {
    return this.members.size >= this.spec.capacity;
  }

  join(id: string, name: string, look: AvatarLook, socket: Socket): Occupant {
    const occupant: Occupant = { id, name, seatId: null, asleep: false, look };
    this.members.set(id, { occupant, socket, lastInput: Date.now(), evictAt: null });
    this.broadcast({ t: "joined", occupant }, id);
    socket.send(
      encode({
        t: "welcome",
        protocol: 1,
        selfId: id,
        room: this.spec,
        occupants: this.occupants,
        media: this.media,
        guestbook: this.guestbook,
      } satisfies ServerMessage),
    );
    return occupant;
  }

  /**
   * A dropped socket does not remove the body. Phones lose wifi constantly and
   * a room that flickers as people reconnect reads as broken, not cosy.
   */
  disconnect(id: string): void {
    const member = this.members.get(id);
    if (!member) return;
    member.socket = null;
    member.evictAt = Date.now() + RECONNECT_GRACE_MS;
  }

  reattach(id: string, socket: Socket): boolean {
    const member = this.members.get(id);
    if (!member) return false;
    member.socket = socket;
    member.evictAt = null;
    member.lastInput = Date.now();
    return true;
  }

  takeSeat(id: string, seatId: string): void {
    const member = this.members.get(id);
    if (!member) return;
    const seat = this.spec.seats.find((s) => s.id === seatId);
    if (!seat) return;
    const taken = [...this.members.values()].some((m) => m.occupant.seatId === seatId);
    if (taken) return;

    member.occupant.seatId = seatId;
    this.touch(member);
    this.broadcast({ t: "moved", id, seatId });
  }

  stand(id: string): void {
    const member = this.members.get(id);
    if (!member || member.occupant.seatId === null) return;
    member.occupant.seatId = null;
    this.touch(member);
    this.broadcast({ t: "moved", id, seatId: null });
  }

  /** Any deliberate input wakes the avatar back up. */
  touch(member: Member): void {
    member.lastInput = Date.now();
    if (member.occupant.asleep) {
      member.occupant.asleep = false;
      this.broadcast({ t: "dozed", id: member.occupant.id, asleep: false });
    }
  }

  touchById(id: string): void {
    const member = this.members.get(id);
    if (member) this.touch(member);
  }

  /** Called on a timer. Puts idle bodies to sleep and evicts expired ones. */
  tick(now = Date.now()): void {
    for (const [id, member] of this.members) {
      if (member.evictAt !== null && now >= member.evictAt) {
        this.members.delete(id);
        this.broadcast({ t: "left", id });
        continue;
      }
      if (!member.occupant.asleep && now - member.lastInput >= DOZE_AFTER_MS) {
        member.occupant.asleep = true;
        this.broadcast({ t: "dozed", id, asleep: true });
      }
    }
  }

  broadcast(message: ServerMessage, exceptId?: string): void {
    const payload = encode(message);
    for (const [id, member] of this.members) {
      if (id === exceptId || member.socket === null) continue;
      member.socket.send(payload);
    }
  }
}

export type RoomSocket = ServerWebSocket<{ occupantId: string; roomId: string }>;
