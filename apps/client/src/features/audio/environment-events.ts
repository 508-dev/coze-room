import type { EnvironmentId } from "@dormouse/protocol";
import type { RoomEvents } from "../../room/events";

declare module "../../room/events" {
  interface SceneEvents {
    environmentChanged: { id: string };
    /** Late-attaching layers use this to ask for a fresh current-environment event. */
    environmentRequested: Record<string, never>;
  }
}

/** Replay the current id to layers attached after the welcome event. */
export function registerEnvironmentRequests(
  events: RoomEvents,
  current: () => EnvironmentId | null,
): () => void {
  return events.on("environmentRequested", () => {
    const id = current();
    if (id !== null) events.emit("environmentChanged", { id });
  });
}
