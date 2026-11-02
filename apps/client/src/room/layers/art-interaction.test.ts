import {
  Container,
  EventBoundary,
  EventSystem,
  FederatedPointerEvent,
  Point,
  Texture,
} from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import manifest from "../../../../../packs/dormouse-v0/manifest.json";
import { PUBLIC_ROOMS } from "../../../../server/src/rooms";
import { RoomEvents } from "../events";
import type { LoadedPack } from "../packs/loader";
import { validateManifest } from "../packs/manifest";
import { roomTransform } from "../space";
import { createSeatsLayer } from "./seats";

const pack: LoadedPack = {
  manifest: validateManifest(manifest),
  baseUrl: "/packs/dormouse-v0/",
  background: Texture.EMPTY,
  windowViews: {},
};

describe("transformed furniture interaction", () => {
  it.each([1, 2, 3, 4, 5, 6].flatMap((scale) => [1, 2].map((dpr) => [scale, dpr])))(
    "hit-tests real pointer down/up through a %ix room transform at DPR %i",
    (scale, dpr) => {
      const room = PUBLIC_ROOMS[0];
      if (!room) throw new Error("no public room");
      const stage = new Container();
      const root = stage.addChild(new Container());
      const [roomWidth, roomHeight] = pack.manifest.room.size;
      const width = roomWidth * scale + 34;
      const height = roomHeight * scale + 58;
      const transform = roomTransform(width, height, pack.manifest.room.size);
      expect(transform.scale).toBe(scale);
      root.scale.set(transform.scale);
      root.position.set(transform.x, transform.y);
      const events = new RoomEvents();
      const clicked = vi.fn();
      events.on("seatClick", clicked);
      const layer = createSeatsLayer();
      layer.attach({ container: root, events, toRoomPoint: (point) => root.toLocal(point) });
      layer.onRoomChange?.(room, pack);

      // Populate the same world matrices as a render prepass, without needing a GPU.
      function updateWorld(container: Container) {
        container.worldTransform.copyFrom(container.getGlobalTransform());
        for (const child of container.children) updateWorld(child);
      }
      updateWorld(stage);
      const boundary = new EventBoundary(stage);
      const canvas = {
        isConnected: true,
        width: width * dpr,
        height: height * dpr,
        getBoundingClientRect: () => ({ left: 17, top: 29, width, height }),
      };
      // Exercise Pixi's production DOM/CSS/resolution mapping, not a hand-written division.
      const mapping = { domElement: canvas, resolution: dpr } as unknown as EventSystem;
      const point = new Point();
      const targets = (root.children[0] as Container).children;
      for (const [index, seat] of room.seats.entries()) {
        EventSystem.prototype.mapPositionToPoint.call(
          mapping,
          point,
          17 + transform.x + (seat.x + 1) * scale,
          29 + transform.y + (seat.y - 2) * scale,
        );
        expect(root.toLocal(point).x).toBeCloseTo(seat.x + 1);
        expect(root.toLocal(point).y).toBeCloseTo(seat.y - 2);
        expect(boundary.hitTest(point.x, point.y)).toBe(targets[index]);
        for (const type of ["pointerdown", "pointerup"]) {
          const event = new FederatedPointerEvent(boundary);
          event.type = type;
          event.pointerId = 1;
          event.pointerType = "touch";
          event.button = 0;
          event.buttons = type === "pointerdown" ? 1 : 0;
          event.global.copyFrom(point);
          boundary.mapEvent(event);
        }
        expect(clicked).toHaveBeenLastCalledWith({ seatId: seat.id });
      }
      expect(clicked).toHaveBeenCalledTimes(room.seats.length);
      expect(boundary.hitTest(transform.x, transform.y)).toBeNull();
      layer.destroy();
      stage.destroy({ children: true });
    },
  );
});

import "pixi.js/events";
