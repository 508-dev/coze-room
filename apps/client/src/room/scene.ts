import type { Occupant, RoomSpec } from "@dormouse/protocol";
import { Application, Container, type PointData, type Ticker } from "pixi.js";
import type { RoomEvents } from "./events";
import { SCENE_SLOTS, type SceneLayer } from "./layers/layer";
import { sceneLayers } from "./layers/registry";
import { type LoadedPack, loadPack } from "./packs/loader";
import { PLACEHOLDER_SIZE, roomTransform } from "./space";

const DRIFT_FPS = 5;

/** Pixi lifecycle, logical room transform, clock and feature-layer orchestration. */
export class Scene {
  readonly app = new Application();
  private root = new Container();
  private layers: SceneLayer[] = [];
  private size = PLACEHOLDER_SIZE;
  private room: RoomSpec | null = null;
  private pack: LoadedPack | null = null;
  private generation = 0;
  private observer: ResizeObserver | null = null;
  private host: HTMLElement | null = null;

  async init(host: HTMLElement, events: RoomEvents): Promise<void> {
    await this.app.init({
      background: 0x0d0b14,
      resizeTo: host,
      preference: "webgl",
      antialias: false,
      roundPixels: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    this.host = host;
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);
    const slots = new Map(SCENE_SLOTS.map((name) => [name, this.root.addChild(new Container())]));
    this.layers = sceneLayers.map((create) => create());
    for (const layer of this.layers) {
      const container = slots.get(layer.slot);
      if (!container) throw new Error(`unknown scene slot: ${layer.slot}`);
      layer.attach({ container, events, toRoomPoint: (point) => this.toRoomPoint(point) });
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.app.ticker.add(this.update);
  }

  private resize(): void {
    if (!this.host) return;
    const { clientWidth: width, clientHeight: height } = this.host;
    this.app.renderer.resize(width, height);
    const transform = roomTransform(width, height, this.size);
    this.root.scale.set(transform.scale);
    this.root.position.set(transform.x, transform.y);
  }

  toRoomPoint(global: PointData): PointData {
    return this.root.toLocal(global);
  }

  drawRoom(room: RoomSpec): void {
    this.room = room;
    this.pack = null;
    this.size = PLACEHOLDER_SIZE;
    const generation = ++this.generation;
    this.notifyRoom();
    // Absence of a selected pack is intentional, not a loading error.
    if (!room.packId) return;
    void loadPack(room.packId).then((pack) => {
      // A previous room's late load must not replace the active room (or a destroyed app).
      if (generation !== this.generation) return;
      this.pack = pack;
      this.size = pack?.manifest.room.size ?? PLACEHOLDER_SIZE;
      this.notifyRoom();
    });
  }

  private notifyRoom(): void {
    if (!this.room) return;
    this.resize();
    for (const layer of this.layers) layer.onRoomChange?.(this.room, this.pack);
  }

  syncOccupants(occupants: Occupant[], selfId: string): void {
    for (const layer of this.layers) layer.onOccupantsChange?.(occupants, selfId);
  }

  private update = (ticker: Ticker): void => {
    const now = performance.now();
    for (const layer of this.layers) layer.update?.(ticker.elapsedMS / 1000, now);
  };

  /** Audio, presence and DOM remain live while the renderer throttles hard. */
  driftOff(active: boolean): void {
    this.app.ticker.maxFPS = active ? DRIFT_FPS : 0;
  }

  destroy(): void {
    ++this.generation;
    this.observer?.disconnect();
    this.app.ticker.remove(this.update);
    for (const layer of this.layers) layer.destroy();
    this.layers = [];
    this.host = null;
    this.app.destroy(true, { children: true });
  }
}
