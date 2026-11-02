import type { PrivateRoomCreated, PublicRoomSummary } from "@dormouse/protocol";
import { normalizePrivateCode } from "@dormouse/protocol";
import { generatePrivateCode } from "./private-codes";
import { Room } from "./room";
import { PUBLIC_ROOMS } from "./rooms";

export const PRIVATE_ROOM_IDLE_MS = 10 * 60 * 1000;

interface PrivateRoomMeta {
  code: string;
  /** Creation time until first join; then the time of the last real eviction. */
  emptySince: number | null;
}

/** Discovery and room lifetime belong here, not in the WebSocket transport. */
export class RoomRegistry {
  private rooms = new Map(PUBLIC_ROOMS.map((spec) => [spec.id, new Room(spec)]));
  private privateRooms = new Map<string, PrivateRoomMeta>();
  private privateCodes = new Map<string, string>();

  constructor(private readonly makeCode: () => string = generatePrivateCode) {}

  get defaultRoomId(): string | undefined {
    return PUBLIC_ROOMS[0]?.id;
  }

  /** Public health/discovery counts must not reveal that private rooms exist. */
  get size(): number {
    return PUBLIC_ROOMS.length;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getByCode(input: string): Room | undefined {
    const code = normalizePrivateCode(input);
    const id = this.privateCodes.get(code);
    return id ? this.rooms.get(id) : undefined;
  }

  isPrivate(id: string): boolean {
    return this.privateRooms.has(id);
  }

  createPrivateRoom(now = Date.now()): PrivateRoomCreated {
    const publicSpec = PUBLIC_ROOMS[0];
    if (!publicSpec) throw new Error("no public room is defined");

    let code: string | undefined;
    for (let attempt = 0; attempt < 100 && !code; attempt += 1) {
      const candidate = this.makeCode();
      if (!this.privateCodes.has(candidate)) code = candidate;
    }
    if (!code) throw new Error("could not allocate a private room code");

    const roomId = `private-${crypto.randomUUID()}`;
    const spec: typeof publicSpec = {
      ...structuredClone(publicSpec),
      id: roomId,
      name: "A private room",
    };
    this.rooms.set(roomId, new Room(spec));
    this.privateRooms.set(roomId, { code, emptySince: now });
    this.privateCodes.set(code, roomId);
    return { roomId, code };
  }

  destroyPrivateRoom(id: string): boolean {
    const meta = this.privateRooms.get(id);
    if (!meta) return false;
    this.privateRooms.delete(id);
    this.privateCodes.delete(meta.code);
    // #75 adds Room.destroy(); stay no-op-safe until that implementation lands.
    const room = this.rooms.get(id) as (Room & { destroy?: () => void }) | undefined;
    room?.destroy?.();
    this.rooms.delete(id);
    return true;
  }

  list(): PublicRoomSummary[] {
    const summaries: PublicRoomSummary[] = [];
    for (const spec of PUBLIC_ROOMS) {
      const room = this.rooms.get(spec.id);
      if (!room) continue;
      summaries.push({
        id: room.spec.id,
        name: room.spec.name,
        occupants: room.occupants.length,
        capacity: room.spec.capacity,
        asleep: room.occupants.filter((o) => o.asleep).length,
      });
    }
    return summaries;
  }

  tick(now = Date.now()): void {
    for (const [id, room] of this.rooms) {
      const occupantsBefore = room.occupants.length;
      room.tick(now);
      const meta = this.privateRooms.get(id);
      if (!meta) continue;

      if (room.occupants.length > 0) {
        meta.emptySince = null;
      } else if (occupantsBefore > 0 || meta.emptySince === null) {
        // Room.disconnect only starts the reconnect grace. This transition is
        // observed after Room.tick performs the actual eviction.
        meta.emptySince = now;
      }

      if (meta.emptySince !== null && now - meta.emptySince >= PRIVATE_ROOM_IDLE_MS) {
        this.destroyPrivateRoom(id);
      }
    }
  }
}
