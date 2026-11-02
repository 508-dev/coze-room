import type { AvatarLook, ServerMessage } from "@dormouse/protocol";
import { describe, expect, it, vi } from "vitest";
import { Room } from "../room";
import { PUBLIC_ROOMS } from "../rooms";
import { createEnvironmentFeature } from "./environment";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const spec = PUBLIC_ROOMS[0];
if (!spec) throw new Error("no public room");

function recorder() {
  const sent: ServerMessage[] = [];
  return {
    sent,
    socket: { send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage) },
  };
}

describe("shared environment", () => {
  it("includes the environment and cooldown in welcome and broadcasts changes", () => {
    let now = 1_000;
    const room = new Room(spec, [() => createEnvironmentFeature({ now: () => now })]);
    const first = recorder();
    room.join("a", "ada", LOOK, first.socket);
    expect(first.sent[0]).toMatchObject({
      t: "welcome",
      environment: "rain",
      environmentCooldownUntil: 0,
    });

    room.handleMessage("a", { t: "setEnvironment", environment: "clear-night" }, first.socket);
    expect(first.sent).toContainEqual({
      t: "environmentChanged",
      environment: "clear-night",
      cooldownUntil: 121_000,
    });

    now = 122_000;
    const second = recorder();
    room.join("b", "bo", LOOK, second.socket);
    expect(second.sent[0]).toMatchObject({
      t: "welcome",
      environment: "clear-night",
      environmentCooldownUntil: 121_000,
    });
  });

  it("enforces one room-wide two-minute cooldown across occupants", () => {
    let now = 5_000;
    const room = new Room(spec, [() => createEnvironmentFeature({ now: () => now })]);
    const first = recorder();
    const second = recorder();
    room.join("a", "ada", LOOK, first.socket);
    room.join("b", "bo", LOOK, second.socket);
    first.sent.length = 0;
    second.sent.length = 0;

    room.handleMessage("a", { t: "setEnvironment", environment: "clear-night" }, first.socket);
    room.handleMessage("b", { t: "setEnvironment", environment: "rain" }, second.socket);

    expect(second.sent).toContainEqual({
      t: "environmentChangeRejected",
      reason: "cooldown",
      cooldownUntil: 125_000,
    });
    now = 124_999;
    room.handleMessage("b", { t: "setEnvironment", environment: "rain" }, second.socket);
    expect(second.sent).toHaveLength(3);
    now = 125_000;
    room.handleMessage("b", { t: "setEnvironment", environment: "rain" }, second.socket);
    expect(second.sent).toContainEqual({
      t: "environmentChanged",
      environment: "rain",
      cooldownUntil: 245_000,
    });
  });

  it("allows only awake occupants and leaves a replaceable policy seam", () => {
    const room = new Room(spec, [() => createEnvironmentFeature()]);
    const socket = recorder();
    room.join("a", "ada", LOOK, socket.socket);
    room.tick(Date.now() + 11 * 60_000);
    socket.sent.length = 0;
    room.handleMessage("a", { t: "setEnvironment", environment: "clear-night" }, socket.socket);
    expect(socket.sent).toContainEqual({
      t: "environmentChangeRejected",
      reason: "not-awake",
      cooldownUntil: 0,
    });

    const canChange = vi.fn(() => false);
    const custom = new Room(spec, [() => createEnvironmentFeature({ canChange })]);
    const other = recorder();
    custom.join("b", "bo", LOOK, other.socket);
    custom.handleMessage("b", { t: "setEnvironment", environment: "clear-night" }, other.socket);
    expect(canChange).toHaveBeenCalledOnce();
    expect(other.sent).toContainEqual(expect.objectContaining({ reason: "not-awake" }));
  });

  it("validates payloads and does not spend cooldown on a no-op selection", () => {
    let now = 1_000;
    const room = new Room(spec, [() => createEnvironmentFeature({ now: () => now })]);
    const socket = recorder();
    room.join("a", "ada", LOOK, socket.socket);
    socket.sent.length = 0;

    room.handleMessage("a", { t: "setEnvironment", environment: "rain" }, socket.socket);
    now += 1_000;
    room.handleMessage("a", { t: "setEnvironment", environment: "clear-night" }, socket.socket);
    expect(socket.sent).toContainEqual(expect.objectContaining({ cooldownUntil: 122_000 }));

    room.handleMessage(
      "a",
      { t: "setEnvironment", environment: "thunder" } as never,
      socket.socket,
    );
    expect(socket.sent.at(-1)).toMatchObject({ environment: "clear-night" });
  });
});
