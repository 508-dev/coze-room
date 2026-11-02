import type { Occupant } from "@dormouse/protocol";
import { describe, expect, it } from "vitest";
import { companionsAtWake, joinNames } from "./guestbook-logic";

const LOOK = { tone: 0, head: 0, top: 0, accessory: 0 };

function occupant(id: string, name: string, asleep: boolean): Occupant {
  return { id, name, seatId: null, asleep, look: LOOK };
}

describe("companionsAtWake", () => {
  it("names the other occupants still asleep, excluding the waker", () => {
    const occupants = [
      occupant("self", "me", false),
      occupant("a", "ada", true),
      occupant("b", "bo", true),
      occupant("c", "cy", false),
    ];
    expect(companionsAtWake(occupants, "self")).toEqual(["ada", "bo"]);
  });

  it("caps the list at a few names", () => {
    const occupants = [
      occupant("self", "me", false),
      occupant("a", "ada", true),
      occupant("b", "bo", true),
      occupant("c", "cy", true),
      occupant("d", "drew", true),
    ];
    expect(companionsAtWake(occupants, "self", 3)).toEqual(["ada", "bo", "cy"]);
  });

  it("returns nothing when no one else is asleep", () => {
    const occupants = [occupant("self", "me", false), occupant("a", "ada", false)];
    expect(companionsAtWake(occupants, "self")).toEqual([]);
  });
});

describe("joinNames", () => {
  it("joins a handful of names conversationally", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["ada"])).toBe("ada");
    expect(joinNames(["ada", "bo"])).toBe("ada and bo");
    expect(joinNames(["ada", "bo", "cy"])).toBe("ada, bo, and cy");
  });
});
