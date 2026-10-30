import type { AvatarLook, RoomSpec, ServerMessage } from "@dormouse/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { Room } from "./room";
import { PUBLIC_ROOMS } from "./rooms";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };

/** Captures what the server would have sent, so broadcasts are assertable. */
function recorder() {
  const sent: ServerMessage[] = [];
  return {
    sent,
    socket: { send: (data: string) => sent.push(JSON.parse(data) as ServerMessage) },
  };
}

function spec(): RoomSpec {
  const first = PUBLIC_ROOMS[0];
  if (!first) throw new Error("no public rooms are defined");
  return structuredClone(first);
}

describe("Room", () => {
  let room: Room;

  beforeEach(() => {
    room = new Room(spec());
  });

  it("welcomes a joiner with the room snapshot", () => {
    const a = recorder();
    room.join("a", "ada", LOOK, a.socket);

    const welcome = a.sent.find((m) => m.t === "welcome");
    expect(welcome).toBeDefined();
    expect(welcome).toMatchObject({ selfId: "a", protocol: 1 });
  });

  it("tells existing occupants about a new arrival, but not the arrival itself", () => {
    const a = recorder();
    const b = recorder();
    room.join("a", "ada", LOOK, a.socket);
    a.sent.length = 0;
    room.join("b", "bo", LOOK, b.socket);

    expect(a.sent.map((m) => m.t)).toContain("joined");
    expect(b.sent.filter((m) => m.t === "joined")).toHaveLength(0);
  });

  it("seats an occupant and broadcasts the move", () => {
    const a = recorder();
    room.join("a", "ada", LOOK, a.socket);
    a.sent.length = 0;
    room.takeSeat("a", "hammock");

    expect(room.occupants[0]?.seatId).toBe("hammock");
    expect(a.sent).toContainEqual({ t: "moved", id: "a", seatId: "hammock" });
  });

  it("refuses a seat that is already taken", () => {
    room.join("a", "ada", LOOK, recorder().socket);
    room.join("b", "bo", LOOK, recorder().socket);
    room.takeSeat("a", "hammock");
    room.takeSeat("b", "hammock");

    expect(room.occupants.find((o) => o.id === "b")?.seatId).toBeNull();
  });

  it("ignores a seat id that does not exist", () => {
    room.join("a", "ada", LOOK, recorder().socket);
    room.takeSeat("a", "there-is-no-such-chair");

    expect(room.occupants[0]?.seatId).toBeNull();
  });

  it("puts an idle occupant to sleep after the threshold", () => {
    const a = recorder();
    room.join("a", "ada", LOOK, a.socket);
    a.sent.length = 0;

    room.tick(Date.now() + 11 * 60 * 1000);

    expect(room.occupants[0]?.asleep).toBe(true);
    expect(a.sent).toContainEqual({ t: "dozed", id: "a", asleep: true });
  });

  it("wakes a sleeper on deliberate input", () => {
    room.join("a", "ada", LOOK, recorder().socket);
    room.tick(Date.now() + 11 * 60 * 1000);
    expect(room.occupants[0]?.asleep).toBe(true);

    room.touchById("a");
    expect(room.occupants[0]?.asleep).toBe(false);
  });

  it("holds a dropped occupant's seat through the grace period", () => {
    room.join("a", "ada", LOOK, recorder().socket);
    room.takeSeat("a", "beanbag");
    room.disconnect("a");

    room.tick(Date.now() + 60 * 1000);
    expect(room.occupants).toHaveLength(1);
    expect(room.occupants[0]?.seatId).toBe("beanbag");
  });

  it("evicts a dropped occupant once the grace period expires", () => {
    room.join("a", "ada", LOOK, recorder().socket);
    room.disconnect("a");

    room.tick(Date.now() + 3 * 60 * 1000);
    expect(room.occupants).toHaveLength(0);
  });

  it("cancels eviction when the occupant reconnects", () => {
    room.join("a", "ada", LOOK, recorder().socket);
    room.disconnect("a");
    expect(room.reattach("a", recorder().socket)).toBe(true);

    room.tick(Date.now() + 3 * 60 * 1000);
    expect(room.occupants).toHaveLength(1);
  });

  it("does not send to a disconnected socket", () => {
    const a = recorder();
    const b = recorder();
    room.join("a", "ada", LOOK, a.socket);
    room.join("b", "bo", LOOK, b.socket);
    room.disconnect("a");
    a.sent.length = 0;

    room.takeSeat("b", "couch-l");
    expect(a.sent).toHaveLength(0);
  });

  it("reports full at capacity", () => {
    const small = new Room({ ...spec(), capacity: 2 });
    small.join("a", "ada", LOOK, recorder().socket);
    expect(small.isFull).toBe(false);
    small.join("b", "bo", LOOK, recorder().socket);
    expect(small.isFull).toBe(true);
  });
});
