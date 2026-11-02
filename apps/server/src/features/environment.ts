import { ENVIRONMENT_IDS, type EnvironmentId, type Occupant } from "@dormouse/protocol";
import type { Room } from "../room";
import type { RoomFeature } from "./feature";

export const ENVIRONMENT_COOLDOWN_MS = 2 * 60 * 1000;

export type EnvironmentChangePolicy = (room: Room, occupant: Occupant) => boolean;

interface EnvironmentFeatureOptions {
  now?: () => number;
  cooldownMs?: number;
  /** Future host/majority rules replace this policy without touching transport. */
  canChange?: EnvironmentChangePolicy;
}

const isEnvironmentId = (value: unknown): value is EnvironmentId =>
  typeof value === "string" && ENVIRONMENT_IDS.includes(value as EnvironmentId);

export function createEnvironmentFeature(options: EnvironmentFeatureOptions = {}): RoomFeature {
  const now = options.now ?? Date.now;
  const cooldownMs = options.cooldownMs ?? ENVIRONMENT_COOLDOWN_MS;
  const canChange = options.canChange ?? ((_room, occupant) => !occupant.asleep);
  let environment: EnvironmentId = "rain";
  let cooldownUntil = 0;

  return {
    welcome() {
      return { environment, environmentCooldownUntil: cooldownUntil };
    },
    onMessage(room, id, message) {
      if (message.t !== "setEnvironment") return undefined;
      if (!isEnvironmentId(message.environment)) return true;

      const occupant = room.occupants.find((candidate) => candidate.id === id);
      if (!occupant || !canChange(room, occupant)) {
        room.send(id, {
          t: "environmentChangeRejected",
          reason: "not-awake",
          cooldownUntil,
        });
        return true;
      }

      // Re-selecting the current bed is a no-op and never spends the cooldown.
      if (message.environment === environment) return true;

      const timestamp = now();
      if (timestamp < cooldownUntil) {
        room.send(id, {
          t: "environmentChangeRejected",
          reason: "cooldown",
          cooldownUntil,
        });
        return true;
      }
      environment = message.environment;
      cooldownUntil = timestamp + cooldownMs;
      room.broadcast({ t: "environmentChanged", environment, cooldownUntil });
      return true;
    },
  };
}
