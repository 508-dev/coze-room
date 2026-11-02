import { describe, expect, it, vi } from "vitest";
import { RoomEvents } from "./events";

describe("room event bridge", () => {
  it("delivers typed payloads and independently unsubscribes listeners", () => {
    const events = new RoomEvents();
    const first = vi.fn();
    const second = vi.fn();
    const off = events.on("seatClick", first);
    events.on("seatClick", second);
    off();
    events.emit("seatClick", { seatId: "hammock" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith({ seatId: "hammock" });
  });

  it("does not share events between app instances", () => {
    const first = new RoomEvents();
    const second = new RoomEvents();
    const handler = vi.fn();
    first.on("seatClick", handler);
    second.emit("seatClick", { seatId: "hammock" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps unsubscribe idempotent across later registrations", () => {
    const events = new RoomEvents();
    const off = events.on("seatClick", () => {});
    off();
    const handler = vi.fn();
    events.on("seatClick", handler);
    off();
    events.emit("seatClick", { seatId: "hammock" });
    expect(handler).toHaveBeenCalledOnce();
  });
});
