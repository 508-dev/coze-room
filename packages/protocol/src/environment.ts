export const ENVIRONMENT_IDS = ["rain", "clear-night"] as const;

export type EnvironmentId = (typeof ENVIRONMENT_IDS)[number];

export interface EnvironmentWelcome {
  environment: EnvironmentId;
  /** Server wall-clock ms; a room-wide change may be made after this time. */
  environmentCooldownUntil: number;
}

export type EnvironmentClientMessage = { t: "setEnvironment"; environment: EnvironmentId };

export type EnvironmentServerMessage =
  | {
      t: "environmentChanged";
      environment: EnvironmentId;
      cooldownUntil: number;
    }
  | {
      t: "environmentChangeRejected";
      reason: "cooldown" | "not-awake";
      cooldownUntil: number;
    };
