import type { AvatarLook } from "@dormouse/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_ROOM_IDLE_MS, RoomRegistry } from "./room-registry";
import { PUBLIC_ROOMS } from "./rooms";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const socket = { send: () => {} };

function privateRoom(registry: RoomRegistry) {
  return registry.createPrivateRoom(0);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RoomRegistry private rooms", () => {
  it("keeps private rooms out of public discovery and counts", () => {
    const registry = new RoomRegistry(() => "amber-apple-arch");
    const publicRooms = registry.list();
    const publicSize = registry.size;

    const created = privateRoom(registry);

    expect(registry.list()).toEqual(publicRooms);
    expect(registry.size).toBe(publicSize);
    expect(registry.get(created.roomId)?.spec).toMatchObject({
      id: created.roomId,
      name: "A private room",
      capacity: PUBLIC_ROOMS[0]?.capacity,
      seats: PUBLIC_ROOMS[0]?.seats,
    });
    expect(registry.getByCode("  AMBER apple arch ")).toBe(registry.get(created.roomId));
  });

  it("retries collisions so every live room has a unique code", () => {
    const codes = ["amber-apple-arch", "amber-apple-arch", "cedar-chalk-cherry"];
    const registry = new RoomRegistry(() => codes.shift() ?? "dawn-dimple-dolphin");

    const first = registry.createPrivateRoom();
    const second = registry.createPrivateRoom();

    expect(first.code).toBe("amber-apple-arch");
    expect(second.code).toBe("cedar-chalk-cherry");
    expect(registry.getByCode(first.code)).toBe(registry.get(first.roomId));
    expect(registry.getByCode(second.code)).toBe(registry.get(second.roomId));
  });

  it("destroys a private room ten minutes after the last real eviction", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const registry = new RoomRegistry(() => "amber-apple-arch");
    const created = registry.createPrivateRoom(0);
    const room = registry.getByCode(created.code);
    if (!room) throw new Error("private room was not created");
    const destroy = vi.fn();
    Object.assign(room, { destroy });

    room.join("a", "ada", LOOK, socket);
    registry.tick(0);
    room.disconnect("a");

    registry.tick(60_000);
    expect(room.occupants).toHaveLength(1);
    expect(registry.getByCode(created.code)).toBe(room);

    const evictedAt = 120_000;
    registry.tick(evictedAt);
    expect(room.occupants).toHaveLength(0);
    registry.tick(evictedAt + PRIVATE_ROOM_IDLE_MS - 1);
    expect(registry.getByCode(created.code)).toBe(room);

    registry.tick(evictedAt + PRIVATE_ROOM_IDLE_MS);
    expect(registry.getByCode(created.code)).toBeUndefined();
    expect(registry.get(created.roomId)).toBeUndefined();
    expect(destroy).toHaveBeenCalledTimes(1);
    registry.tick(evictedAt + PRIVATE_ROOM_IDLE_MS + 1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("starts the destruction timer only when the last occupant is evicted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const registry = new RoomRegistry(() => "amber-apple-arch");
    const created = registry.createPrivateRoom(0);
    const room = registry.getByCode(created.code);
    if (!room) throw new Error("private room was not created");
    room.join("a", "ada", LOOK, socket);
    room.join("b", "bo", LOOK, socket);
    registry.tick(0);

    room.disconnect("a");
    registry.tick(120_000);
    expect(room.occupants.map((occupant) => occupant.id)).toEqual(["b"]);
    registry.tick(120_000 + PRIVATE_ROOM_IDLE_MS);
    expect(registry.getByCode(created.code)).toBe(room);

    vi.setSystemTime(120_000 + PRIVATE_ROOM_IDLE_MS);
    room.disconnect("b");
    const lastEviction = 240_000 + PRIVATE_ROOM_IDLE_MS;
    registry.tick(lastEviction);
    expect(room.occupants).toHaveLength(0);
    registry.tick(lastEviction + PRIVATE_ROOM_IDLE_MS - 1);
    expect(registry.getByCode(created.code)).toBe(room);
    registry.tick(lastEviction + PRIVATE_ROOM_IDLE_MS);
    expect(registry.getByCode(created.code)).toBeUndefined();
  });

  it("expires a room that nobody joins and releases its code on destruction", () => {
    const registry = new RoomRegistry(() => "amber-apple-arch");
    const created = registry.createPrivateRoom(1_000);

    registry.tick(1_000 + PRIVATE_ROOM_IDLE_MS - 1);
    expect(registry.getByCode(created.code)).toBeDefined();
    registry.tick(1_000 + PRIVATE_ROOM_IDLE_MS);
    expect(registry.getByCode(created.code)).toBeUndefined();

    const reused = registry.createPrivateRoom(2_000);
    expect(reused.code).toBe(created.code);
    expect(registry.destroyPrivateRoom(reused.roomId)).toBe(true);
    expect(registry.destroyPrivateRoom(reused.roomId)).toBe(false);
  });
});
