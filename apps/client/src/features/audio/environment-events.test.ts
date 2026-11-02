import { describe, expect, it, vi } from "vitest";
import { RoomEvents } from "../../room/events";
import { registerEnvironmentRequests } from "./environment-events";

describe("environment event handshake", () => {
  it("replays the current id to a late-attaching subscriber", () => {
    const events = new RoomEvents();
    registerEnvironmentRequests(events, () => "clear-night");
    const changed = vi.fn();
    events.on("environmentChanged", changed);
    events.emit("environmentRequested", {});
    expect(changed).toHaveBeenCalledExactlyOnceWith({ id: "clear-night" });
  });

  it("waits for welcome instead of replaying a default id", () => {
    const events = new RoomEvents();
    registerEnvironmentRequests(events, () => null);
    const changed = vi.fn();
    events.on("environmentChanged", changed);
    events.emit("environmentRequested", {});
    expect(changed).not.toHaveBeenCalled();
  });
});
