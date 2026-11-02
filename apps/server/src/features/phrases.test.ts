import type { AvatarLook, ServerMessage } from "@dormouse/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Room } from "../room";
import { PUBLIC_ROOMS } from "../rooms";
import { createPhrasesFeature } from "./phrases";
import { RateLimiter } from "./rate-limit";

const LOOK: AvatarLook = { tone: 0, head: 0, top: 0, accessory: 0 };
const spec = PUBLIC_ROOMS[0];
if (!spec) throw new Error("no public room");

function recorder() {
  const sent: ServerMessage[] = [];
  return { sent, socket: { send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage) } };
}

function saidCount(sent: ServerMessage[]): number {
  return sent.filter((m) => m.t === "said").length;
}

afterEach(() => vi.restoreAllMocks());

describe("RateLimiter", () => {
  it("allows a burst then enforces the refill rate", () => {
    const limiter = new RateLimiter(3, 3_000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 100)).toBe(true);
    expect(limiter.allow("a", 200)).toBe(true);
    expect(limiter.allow("a", 300)).toBe(false);

    // One token earns back after a full interval.
    expect(limiter.allow("a", 3_000 + 200)).toBe(true);
    expect(limiter.allow("a", 3_000 + 300)).toBe(false);
  });

  it("tracks each key independently", () => {
    const limiter = new RateLimiter(1, 3_000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 0)).toBe(false);
    expect(limiter.allow("b", 0)).toBe(true);
  });

  it("never grants tokens on a backwards clock", () => {
    const limiter = new RateLimiter(1, 3_000);
    expect(limiter.allow("a", 5_000)).toBe(true);
    expect(limiter.allow("a", 4_000)).toBe(false);
  });
});

describe("phrases feature", () => {
  it("broadcasts a valid say to everyone, including the speaker", () => {
    const room = new Room(spec, [createPhrasesFeature]);
    const a = recorder();
    const b = recorder();
    room.join("a", "ada", LOOK, a.socket);
    room.join("b", "bo", LOOK, b.socket);
    a.sent.length = 0;
    b.sent.length = 0;

    const at = Date.now();
    room.handleMessage("a", { t: "say", phraseId: "goodnight-night" }, a.socket);

    expect(a.sent).toEqual([{ t: "said", id: "a", phraseId: "goodnight-night", at }]);
    expect(b.sent).toEqual([{ t: "said", id: "a", phraseId: "goodnight-night", at }]);
  });

  it("drops an unknown phrase id silently", () => {
    const room = new Room(spec, [createPhrasesFeature]);
    const a = recorder();
    room.join("a", "ada", LOOK, a.socket);
    a.sent.length = 0;

    room.handleMessage("a", { t: "say", phraseId: "greeting-not-a-real-phrase" }, a.socket);

    expect(saidCount(a.sent)).toBe(0);
  });

  it("drops a fourth immediate say and lets the burst refill", () => {
    let now = 1_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const room = new Room(spec, [createPhrasesFeature]);
    const a = recorder();
    room.join("a", "ada", LOOK, a.socket);
    a.sent.length = 0;

    for (let i = 0; i < 3; i++) {
      room.handleMessage("a", { t: "say", phraseId: "greeting-hey" }, a.socket);
    }
    expect(saidCount(a.sent)).toBe(3);

    room.handleMessage("a", { t: "say", phraseId: "greeting-hey" }, a.socket);
    expect(saidCount(a.sent)).toBe(3);

    now += 3_000;
    room.handleMessage("a", { t: "say", phraseId: "greeting-hey" }, a.socket);
    expect(saidCount(a.sent)).toBe(4);

    spy.mockRestore();
  });

  it("wakes only the speaker, not the other sleepers", () => {
    const room = new Room(spec, [createPhrasesFeature]);
    const a = recorder();
    const b = recorder();
    room.join("a", "ada", LOOK, a.socket);
    room.join("b", "bo", LOOK, b.socket);
    room.tick(Date.now() + 11 * 60_000);
    expect(room.occupants.map((o) => [o.id, o.asleep])).toEqual([
      ["a", true],
      ["b", true],
    ]);

    room.handleMessage("a", { t: "say", phraseId: "greeting-hey" }, a.socket);

    expect(room.occupants.find((o) => o.id === "a")?.asleep).toBe(false);
    expect(room.occupants.find((o) => o.id === "b")?.asleep).toBe(true);
  });

  it("does not claim messages it does not own", () => {
    const room = new Room(spec, [createPhrasesFeature]);
    const a = recorder();
    room.join("a", "ada", LOOK, a.socket);
    a.sent.length = 0;

    room.handleMessage("a", { t: "awake" }, a.socket);
    // "awake" is presence's message: phrases must not have broadcast anything.
    expect(a.sent).toEqual([]);
  });
});
