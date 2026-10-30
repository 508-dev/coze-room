import type { Occupant, RoomSpec, Seat } from "@dormouse/protocol";
import { Application, Container, Graphics } from "pixi.js";

/**
 * Placeholder rendering.
 *
 * Everything here is flat colour. The real room is pixel art composited from
 * versioned packs, and the point of this file is to prove the loop -- a room
 * you can see, seats you can click, bodies that appear where they should --
 * without blocking on art.
 */

const SEAT_COLOUR: Record<Seat["kind"], number> = {
  couch: 0x4a3b63,
  beanbag: 0x6b4f3a,
  hammock: 0x3a5563,
};

/** Frame rate once the user has stopped interacting. See driftOff(). */
const DRIFT_FPS = 5;

export interface SceneCallbacks {
  onSeatClick(seatId: string): void;
}

export class Scene {
  readonly app = new Application();
  private seatLayer = new Container();
  private bodyLayer = new Container();
  private bodies = new Map<string, Graphics>();
  private seatPositions = new Map<string, { x: number; y: number }>();

  async init(host: HTMLElement, callbacks: SceneCallbacks): Promise<void> {
    await this.app.init({
      background: 0x140f1e,
      resizeTo: host,
      antialias: false,
      // Pixel art is sampled nearest-neighbour; smoothing would defeat it.
      roundPixels: true,
      autoDensity: true,
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.seatLayer, this.bodyLayer);
    this.callbacks = callbacks;
  }

  private callbacks: SceneCallbacks = { onSeatClick: () => {} };

  drawRoom(room: RoomSpec): void {
    this.seatLayer.removeChildren();
    this.seatPositions.clear();

    for (const seat of room.seats) {
      const width = seat.kind === "couch" ? 64 : seat.kind === "hammock" ? 88 : 48;
      const height = seat.pose === "lie" ? 24 : 40;

      const g = new Graphics().roundRect(0, 0, width, height, 6).fill(SEAT_COLOUR[seat.kind]);
      g.position.set(seat.x, seat.y);
      g.zIndex = seat.depth;
      g.eventMode = "static";
      g.cursor = "pointer";
      g.on("pointertap", () => this.callbacks.onSeatClick(seat.id));

      this.seatLayer.addChild(g);
      this.seatPositions.set(seat.id, { x: seat.x + width / 2, y: seat.y - 12 });
    }
    this.seatLayer.sortableChildren = true;
  }

  syncOccupants(occupants: Occupant[], selfId: string): void {
    const seen = new Set<string>();

    for (const occupant of occupants) {
      seen.add(occupant.id);
      let body = this.bodies.get(occupant.id);
      if (!body) {
        body = new Graphics();
        this.bodies.set(occupant.id, body);
        this.bodyLayer.addChild(body);
      }

      // Self is brighter; sleepers are dimmed. Stand-ins for real sprites.
      const tint = occupant.id === selfId ? 0xf0e6ff : 0xa89cc0;
      body
        .clear()
        .circle(0, 0, 9)
        .fill({ color: tint, alpha: occupant.asleep ? 0.45 : 1 });

      const spot = occupant.seatId ? this.seatPositions.get(occupant.seatId) : undefined;
      body.position.set(spot?.x ?? 60, spot?.y ?? 380);
    }

    for (const [id, body] of this.bodies) {
      if (seen.has(id)) continue;
      body.destroy();
      this.bodies.delete(id);
    }
  }

  /**
   * Throttle hard rather than stopping. The room keeps breathing at a frame
   * rate nobody awake would accept, which is the point: audio and presence
   * continue while the GPU goes quiet.
   */
  driftOff(active: boolean): void {
    this.app.ticker.maxFPS = active ? DRIFT_FPS : 0;
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
