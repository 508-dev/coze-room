import type { Seat } from "@dormouse/protocol";

export function seatGeometry(seat: Seat) {
  const width = seat.kind === "couch" ? 64 : seat.kind === "hammock" ? 88 : 48;
  const height = seat.pose === "lie" ? 24 : 40;
  return { width, height, bodyX: seat.x + width / 2, bodyY: seat.y - 12 };
}
