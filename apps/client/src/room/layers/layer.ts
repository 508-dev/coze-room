import type { Occupant, RoomSpec } from "@dormouse/protocol";
import type { Container, PointData } from "pixi.js";
import type { RoomEvents } from "../events";
import type { LoadedPack } from "../packs/loader";

/** Window views are behind the cut-outs, but above the base background. */
export const SCENE_SLOTS = [
  "background",
  "windowView",
  "furnitureBack",
  "avatars",
  "furnitureFront",
  "bubbles",
  "overlay",
] as const;
export type SceneSlot = (typeof SCENE_SLOTS)[number];

export interface LayerContext {
  /** Owned slot. Add display objects here, in logical room coordinates. */
  container: Container;
  events: RoomEvents;
  /** Pixi event.global -> logical coordinates; transformed hit tests are automatic. */
  toRoomPoint(global: PointData): PointData;
}

export interface SceneLayer {
  slot: SceneSlot;
  attach(context: LayerContext): void;
  /** dt is seconds; now is performance.now() in milliseconds. */
  update?(dt: number, now: number): void;
  onRoomChange?(room: RoomSpec, pack: LoadedPack | null): void;
  onOccupantsChange?(occupants: Occupant[], selfId: string): void;
  /** Release listeners/resources; the scene destroys slot display objects afterwards. */
  destroy(): void;
}

export type SceneLayerFactory = () => SceneLayer;
