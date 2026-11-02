import { describe, expect, it } from "vitest";
import { ATTRACT_LOOP_MS, ATTRACT_ROOM, attractOccupantsAt } from "./fake-room";

describe("attract room script", () => {
  it("uses the real pack and its room-space seat anchors", () => {
    expect(ATTRACT_ROOM.packId).toBe("dormouse-v0");
    expect(ATTRACT_ROOM.seats.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "couch-l", x: 42, y: 59 },
      { id: "couch-r", x: 65, y: 60 },
      { id: "beanbag", x: 18, y: 64 },
      { id: "hammock", x: 104, y: 62 },
    ]);
  });

  it("seats the cast in order and dozes them on a deterministic timeline", () => {
    expect(attractOccupantsAt(0).map(({ seatId, asleep }) => ({ seatId, asleep }))).toEqual([
      { seatId: "couch-l", asleep: false },
    ]);
    expect(attractOccupantsAt(4_000).map(({ seatId }) => seatId)).toEqual(["couch-l", "couch-r"]);
    expect(attractOccupantsAt(8_000).map(({ seatId }) => seatId)).toEqual([
      "couch-l",
      "couch-r",
      "hammock",
    ]);
    expect(attractOccupantsAt(12_000).map(({ asleep }) => asleep)).toEqual([true, false, false]);
    expect(attractOccupantsAt(28_000).map(({ asleep }) => asleep)).toEqual([true, true, true]);
  });

  it("loops exactly and never exposes occupant names", () => {
    expect(attractOccupantsAt(ATTRACT_LOOP_MS + 4_000)).toEqual(attractOccupantsAt(4_000));
    expect(attractOccupantsAt(20_000).every(({ name }) => name === "")).toBe(true);
  });
});
