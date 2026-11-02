import type { RoomFeature } from "./feature";

export function createSeatingFeature(): RoomFeature {
  return {
    onMessage(room, id, message) {
      if (message.t === "takeSeat") {
        room.takeSeat(id, message.seatId);
        return true;
      }
      if (message.t === "stand") {
        room.stand(id);
        return true;
      }
      return undefined;
    },
  };
}
