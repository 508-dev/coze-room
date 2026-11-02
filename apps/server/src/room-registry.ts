import { Room } from "./room";
import { PUBLIC_ROOMS } from "./rooms";

/** Discovery and room lifetime belong here, not in the WebSocket transport. */
export class RoomRegistry {
  private rooms = new Map(PUBLIC_ROOMS.map((spec) => [spec.id, new Room(spec)]));

  get defaultRoomId(): string | undefined {
    return PUBLIC_ROOMS[0]?.id;
  }

  get size(): number {
    return this.rooms.size;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  list() {
    return [...this.rooms.values()].map((room) => ({
      id: room.spec.id,
      name: room.spec.name,
      occupants: room.occupants.length,
      capacity: room.spec.capacity,
      asleep: room.occupants.filter((o) => o.asleep).length,
    }));
  }

  tick(now = Date.now()): void {
    for (const room of this.rooms.values()) room.tick(now);
  }
}
