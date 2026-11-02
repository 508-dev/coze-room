import type { RoomFeature } from "./feature";

export function createPresenceFeature(): RoomFeature {
  return {
    onMessage(room, id, message) {
      if (message.t === "awake") {
        room.touchById(id);
        return true;
      }
      if (message.t === "pong") return true;
      return undefined;
    },
  };
}
