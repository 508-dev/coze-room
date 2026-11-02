import type { ClientMessage, Occupant, RoomSpec } from "@dormouse/protocol";
import { createClientFeatures } from "../features/registry";
import { Connection } from "../net/connection";
import { RoomEvents } from "../room/events";

const DRIFT_AFTER_MS = 10 * 60 * 1000;

/** One state instance per mounted app, not a module-level session singleton. */
export class RoomState {
  selfId = $state<string | null>(null);
  room = $state<RoomSpec | null>(null);
  occupants = $state<Occupant[]>([]);
  drifting = $state(false);
  connected = $state(false);
  asleepCount = $derived(this.occupants.filter((o) => o.asleep).length);
  readonly features = createClientFeatures();
  readonly events = new RoomEvents();

  private connection: Connection | null = null;
  private cleanup: (() => void)[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  join(roomId: string): void {
    this.dispose();
    const connection = new Connection(roomId, {
      name: "guest",
      look: { tone: 0, head: 0, top: 0, accessory: 0 },
    });
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
