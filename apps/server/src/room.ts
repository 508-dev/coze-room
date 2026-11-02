import type {
  AvatarLook,
  ClientMessage,
  Occupant,
  RoomSpec,
  ServerMessage,
  WelcomeMessage,
} from "@dormouse/protocol";
import { encode, PROTOCOL_VERSION } from "@dormouse/protocol";
import type { ServerWebSocket } from "bun";
import { isValidCoreClientMessage } from "./client-message";
import type { RoomFeature, RoomFeatureFactory } from "./features/feature";
import { roomFeatures } from "./features/registry";

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
  private features: RoomFeature[];

  constructor(spec: RoomSpec, factories: readonly RoomFeatureFactory[] = roomFeatures) {
    this.spec = spec;
    this.features = factories.map((create) => create());
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
    for (const feature of this.features) feature.onJoin?.(this, occupant);
    this.broadcast({ t: "joined", occupant }, id);
    const welcome: WelcomeMessage = {
      t: "welcome",
      protocol: PROTOCOL_VERSION,
      selfId: id,
      room: this.spec,
      occupants: this.occupants,
      // Wire-compatible defaults until the corresponding features contribute snapshots.
      media: { itemId: null, startedAt: 0 },
      guestbook: [],
    };
    for (const feature of this.features) Object.assign(welcome, feature.welcome?.(this, id));
    socket.send(encode(welcome));
    return occupant;
  }

  /** Transport only decodes; room features own the joined-client message routes. */
  handleMessage(id: string, message: ClientMessage, socket: Socket): void {
    if (!isValidCoreClientMessage(message)) return;
    try {
      if (message.t === "join") {
        this.join(id, message.name.slice(0, 24), message.look, socket);
        return;
      }
      if (!this.members.has(id)) return;
      for (const feature of this.features) {
        if (feature.onMessage?.(this, id, message)) return;
      }
    } catch (error) {
      // Abort this message, not the socket handler; never log the untrusted payload.
      console.error(
        "room message handler failed",
        { roomId: this.spec.id, type: message.t },
        error,
      );
    }
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
        for (const feature of this.features) feature.onLeave?.(this, member.occupant);
        continue;
      }
      if (!member.occupant.asleep && now - member.lastInput >= DOZE_AFTER_MS) {
        member.occupant.asleep = true;
        this.broadcast({ t: "dozed", id, asleep: true });
      }
    }
    for (const feature of this.features) feature.onTick?.(this, now);
  }

  broadcast(message: ServerMessage, exceptId?: string): void {
    const payload = encode(message);
    for (const [id, member] of this.members) {
      if (id === exceptId || member.socket === null) continue;
      member.socket.send(payload);
    }
  }

  /** Feature responses addressed to one connected occupant. */
  send(id: string, message: ServerMessage): void {
    this.members.get(id)?.socket?.send(encode(message));
  }
}

export type RoomSocket = ServerWebSocket<{ occupantId: string; roomId: string }>;
