import type { AvatarLook, ServerMessage } from "@dormouse/protocol";
import { describe, expect, it, vi } from "vitest";
import { Room } from "../room";
import { PUBLIC_ROOMS } from "../rooms";
import type { RoomFeature, RoomFeatureFactory } from "./feature";
import { roomFeatures } from "./registry";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const spec = PUBLIC_ROOMS[0];
if (!spec) throw new Error("no public room");

function recorder() {
  const sent: ServerMessage[] = [];
  return { sent, send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage) };
}

describe("room features", () => {
  it("runs join before collecting welcome fields, keeping the original envelope", () => {
    const order: string[] = [];
    const feature: RoomFeature = {
      onJoin(room, occupant) {
        expect(room.occupants).toContain(occupant);
        order.push("join");
      },
      welcome(_room, id) {
        expect(id).toBe("a");
        order.push("welcome");
        return { media: { itemId: "fixture", startedAt: 123 } };
      },
    };
    const room = new Room(spec, [() => feature]);
    const socket = recorder();
    room.handleMessage("a", { t: "join", name: "a".repeat(30), look: LOOK }, socket);
    expect(order).toEqual(["join", "welcome"]);
    expect(socket.sent[0]).toMatchObject({
      t: "welcome",
      protocol: 1,
      selfId: "a",
      media: { itemId: "fixture", startedAt: 123 },
      guestbook: [],
    });
    expect(room.occupants[0]?.name).toHaveLength(24);
  });

  it("routes in registry order and stops at the feature claiming a message", () => {
    const before = vi.fn(() => undefined);
    const owner = vi.fn(() => true);
    const after = vi.fn(() => undefined);
    const room = new Room(
      spec,
      [before, owner, after].map((onMessage) => () => ({ onMessage })),
    );
    const socket = recorder();
    room.join("a", "ada", LOOK, socket);
    const message = { t: "pong" } as const;
    room.handleMessage("a", message, socket);
    expect(before).toHaveBeenCalledWith(room, "a", message);
    expect(owner).toHaveBeenCalledWith(room, "a", message);
    expect(after).not.toHaveBeenCalled();
  });

  it("does not dispatch feature messages before joining", () => {
    const onMessage = vi.fn();
    const room = new Room(spec, [() => ({ onMessage })]);
    room.handleMessage("unknown", { t: "pong" }, recorder());
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("dispatches seating and wake messages through the default registry", () => {
    const room = new Room(spec);
    const socket = recorder();
    room.join("a", "ada", LOOK, socket);
    room.handleMessage("a", { t: "takeSeat", seatId: "hammock" }, socket);
    expect(room.occupants[0]?.seatId).toBe("hammock");
    room.tick(Date.now() + 11 * 60_000);
    room.handleMessage("a", { t: "awake" }, socket);
    expect(room.occupants[0]?.asleep).toBe(false);
    room.handleMessage("a", { t: "stand" }, socket);
    expect(room.occupants[0]?.seatId).toBeNull();
  });

  it("calls leave only on actual eviction and passes the timer's timestamp", () => {
    const onLeave = vi.fn();
    const onTick = vi.fn();
    const room = new Room(spec, [() => ({ onLeave, onTick })]);
    room.join("a", "ada", LOOK, recorder());
    const occupant = room.occupants[0];
    room.disconnect("a");
    expect(onLeave).not.toHaveBeenCalled();
    const now = Date.now() + 3 * 60_000;
    room.tick(now);
    expect(onLeave).toHaveBeenCalledExactlyOnceWith(room, occupant);
    expect(onTick).toHaveBeenCalledExactlyOnceWith(room, now);
    room.tick(now);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("creates independent feature state for each room", () => {
    const create: RoomFeatureFactory = () => {
      let joins = 0;
      return {
        onJoin() {
          joins++;
        },
        welcome() {
          return { media: { itemId: null, startedAt: joins } };
        },
      };
    };
    const first = new Room(spec, [...roomFeatures, create]);
    const second = new Room(spec, [...roomFeatures, create]);
    first.join("a", "ada", LOOK, recorder());
    first.join("b", "bo", LOOK, recorder());
    const socket = recorder();
    second.join("c", "cy", LOOK, socket);
    expect(socket.sent[0]).toMatchObject({ media: { startedAt: 1 } });
  });
});
