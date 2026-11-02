import type { Occupant, RoomSpec } from "@dormouse/protocol";
import { RoomEvents } from "../room/events";
import { Scene, type SceneInitOptions } from "../room/scene";
import { ATTRACT_LOOP_MS, ATTRACT_ROOM, attractOccupantsAt } from "./fake-room";

export const ATTRACT_RENDER_RESOLUTION = 0.5;
export const ATTRACT_FPS = 8;
const SCRIPT_STEP_MS = 1_000;

export interface AttractScene {
  init(host: HTMLElement, events: RoomEvents, options: SceneInitOptions): Promise<void>;
  drawRoom(room: RoomSpec): void;
  syncOccupants(occupants: Occupant[], selfId: string): void;
  setPaused(paused: boolean): void;
  destroy(): void;
}

interface VisibilityTarget {
  hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/** Runs the real Scene from a local deterministic script, with no network connection. */
export class AttractPlayback {
  private elapsedMs = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private ready = false;
  private destroyed = false;

  constructor(
    private readonly scene: AttractScene = new Scene(),
    private readonly visibility: VisibilityTarget = document,
  ) {}

  async init(host: HTMLElement): Promise<void> {
    await this.scene.init(host, new RoomEvents(), {
      resolution: ATTRACT_RENDER_RESOLUTION,
      maxFPS: ATTRACT_FPS,
      interactive: false,
    });
    if (this.destroyed) {
      this.scene.destroy();
      return;
    }
    this.ready = true;
    this.scene.drawRoom(ATTRACT_ROOM);
    this.scene.syncOccupants(attractOccupantsAt(this.elapsedMs), "");
    this.visibility.addEventListener("visibilitychange", this.onVisibilityChange);
    this.syncVisibility();
  }

  private tick = (): void => {
    this.elapsedMs = (this.elapsedMs + SCRIPT_STEP_MS) % ATTRACT_LOOP_MS;
    this.scene.syncOccupants(attractOccupantsAt(this.elapsedMs), "");
  };

  private onVisibilityChange = (): void => {
    this.syncVisibility();
  };

  private syncVisibility(): void {
    if (this.visibility.hidden) {
      this.stopClock();
      this.scene.setPaused(true);
      return;
    }
    this.scene.setPaused(false);
    if (this.timer !== undefined) return;
    this.timer = setInterval(this.tick, SCRIPT_STEP_MS);
  }

  private stopClock(): void {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopClock();
    this.visibility.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.ready) this.scene.destroy();
  }
}
