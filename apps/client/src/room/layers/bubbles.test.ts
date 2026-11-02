import type { Occupant } from "@dormouse/protocol";
import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { PUBLIC_ROOMS } from "../../../../server/src/rooms";
import { RoomEvents } from "../events";
import { pixelTextWidth } from "../text/pixel-font";
import {
  BUBBLE_FADE_MS,
  BUBBLE_LIFETIME_MS,
  bubbleAlpha,
  bubbleExpired,
  createBubblesLayer,
} from "./bubbles";

const room = PUBLIC_ROOMS[0];
if (!room) throw new Error("no public room");

const occupant: Occupant = {
  id: "a",
  name: "ada",
  seatId: "hammock",
  asleep: false,
  look: { tone: 0, head: 0, top: 0, accessory: 0 },
};

function phrase(text: string) {
  return { id: "a", phraseId: "goodnight-night", text, at: 0 };
}

describe("bubble lifetime", () => {
  it("holds full opacity, then fades to zero at the lifetime", () => {
    expect(bubbleAlpha(0)).toBe(1);
    expect(bubbleAlpha(BUBBLE_LIFETIME_MS - BUBBLE_FADE_MS)).toBe(1);
    expect(bubbleAlpha(BUBBLE_LIFETIME_MS - BUBBLE_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(bubbleAlpha(BUBBLE_LIFETIME_MS)).toBe(0);
  });

  it("expires exactly at the lifetime", () => {
    expect(bubbleExpired(BUBBLE_LIFETIME_MS - 1)).toBe(false);
    expect(bubbleExpired(BUBBLE_LIFETIME_MS)).toBe(true);
  });
});

describe("bubbles layer", () => {
  it("shows one bubble per speaker and replaces the previous one", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createBubblesLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, null);
    layer.onOccupantsChange?.([occupant], "a");

    events.emit("phrase", phrase("night night"));
    const root = container.children[0] as Container;
    expect(root.children).toHaveLength(1);

    events.emit("phrase", phrase("sleep well"));
    expect(root.children).toHaveLength(1);

    layer.destroy();
    container.destroy({ children: true });
  });

  it("anchors the bubble above the speaker's avatar", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createBubblesLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, null);
    layer.onOccupantsChange?.([occupant], "a");

    events.emit("phrase", phrase("night night"));
    const root = container.children[0] as Container;
    const bubble = root.children[0] as Container;
    // Hammock body centre is (524, 238); the bubble must sit above its head.
    expect(bubble.position.y).toBe(238 - 9 - 3 - 13);
    const centerX = bubble.position.x + (pixelTextWidth("night night") + 8) / 2;
    expect(Math.abs(centerX - 524)).toBeLessThanOrEqual(0.5);

    layer.destroy();
    container.destroy({ children: true });
  });

  it("fades and removes a bubble once its lifetime elapses", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createBubblesLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, null);
    layer.onOccupantsChange?.([occupant], "a");

    events.emit("phrase", phrase("night night"));
    const root = container.children[0] as Container;
    expect(root.children).toHaveLength(1);

    layer.update?.(0, 1_000);
    expect(root.children).toHaveLength(1);
    layer.update?.(0, 1_000 + BUBBLE_LIFETIME_MS);
    expect(root.children).toHaveLength(0);

    layer.destroy();
    container.destroy({ children: true });
  });

  it("keeps bubbles for different speakers independent", () => {
    const container = new Container();
    const events = new RoomEvents();
    const layer = createBubblesLayer();
    layer.attach({ container, events, toRoomPoint: (p) => p });
    layer.onRoomChange?.(room, null);
    layer.onOccupantsChange?.([occupant, { ...occupant, id: "b", seatId: "couch-l" }], "a");

    events.emit("phrase", { id: "a", phraseId: "goodnight-night", text: "night night", at: 0 });
    events.emit("phrase", { id: "b", phraseId: "goodnight-night", text: "sleep well", at: 0 });
    const root = container.children[0] as Container;
    expect(root.children).toHaveLength(2);

    layer.destroy();
    container.destroy({ children: true });
  });
});
