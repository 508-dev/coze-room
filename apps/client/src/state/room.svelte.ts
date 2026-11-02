import type { ClientMessage, Occupant, RoomSpec } from "@dormouse/protocol";
import { normalizePrivateCode } from "@dormouse/protocol";
import { createClientFeatures } from "../features/registry";
import { Connection, type RoomTarget } from "../net/connection";
import { RoomEvents } from "../room/events";

const DRIFT_AFTER_MS = 10 * 60 * 1000;

/** One state instance per mounted app, not a module-level session singleton. */
export class RoomState {
  selfId = $state<string | null>(null);
  room = $state<RoomSpec | null>(null);
  occupants = $state<Occupant[]>([]);
  drifting = $state(false);
  connected = $state(false);
  roomClosed = $state(false);
  roomFull = $state(false);
  asleepCount = $derived(this.occupants.filter((o) => o.asleep).length);
  readonly features = createClientFeatures();
  readonly events = new RoomEvents();

  private connection: Connection | null = null;
  private cleanup: (() => void)[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  join(roomId: string): void {
    this.connect({ roomId });
  }

  joinByCode(code: string): void {
    this.connect({ code: normalizePrivateCode(code) });
  }

  resetToStart(): void {
    this.dispose();
    this.roomClosed = false;
    this.roomFull = false;
    this.occupants = [];
  }

  private connect(target: RoomTarget): void {
    this.dispose();
    this.roomClosed = false;
    this.roomFull = false;
    this.connected = false;
    this.selfId = null;
    this.room = null;
    this.occupants = [];
    const connection = new Connection(
      target,
      {
        name: "guest",
        look: { tone: 0, head: 0, top: 0, accessory: 0 },
      },
      () => {
        if (this.connection === connection) this.roomClosed = true;
      },
    );
    this.connection = connection;
    this.cleanup = Object.values(this.features).map((feature) =>
      feature.register(this, connection),
    );
    connection.connect();
    this.wake();
  }

  send(message: ClientMessage): void {
    this.connection?.send(message);
  }

  wake(): void {
    if (this.drifting) {
      this.drifting = false;
      this.send({ t: "awake" });
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.drifting = true;
    }, DRIFT_AFTER_MS);
  }

  takeSeat(seatId: string): void {
    this.wake();
    this.send({ t: "takeSeat", seatId });
  }

  dispose(): void {
    clearTimeout(this.idleTimer);
    for (const remove of this.cleanup) remove();
    this.cleanup = [];
    this.connection?.dispose();
    this.connection = null;
  }
}
