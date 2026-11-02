import { isPhraseId } from "@dormouse/protocol";
import type { RoomFeature } from "./feature";
import { RateLimiter } from "./rate-limit";

/** Sustained rate: one phrase per three seconds, with a small burst up front. */
const SAY_BURST = 3;
const SAY_REFILL_MS = 3_000;

export function createPhrasesFeature(): RoomFeature {
  // Buckets are keyed by occupant id. A reconnect currently mints a new
  // occupant id (a core upgrade bug), so the limit resets across a reconnect;
  // stable reconnect identity will fix that. Until then the limit is per
  // connection-session.
  const limiter = new RateLimiter(SAY_BURST, SAY_REFILL_MS);
  return {
    onMessage(room, id, message) {
      if (message.t !== "say") return undefined;
      // Unknown ids and over-limit sends are dropped silently: no broadcast,
      // no error, and (for the speaker) no bubble. Text is never relayed.
      if (!isPhraseId(message.phraseId)) return true;
      const now = Date.now();
      if (!limiter.allow(id, now)) return true;
      // Saying is deliberate input, but only for the speaker.
      room.touchById(id);
      room.broadcast({ t: "said", id, phraseId: message.phraseId, at: now });
      return true;
    },
    onLeave(_room, occupant) {
      // Eviction frees the bucket; a transient disconnect keeps it through the
      // reconnect grace period (onLeave runs only after actual eviction).
      limiter.forget(occupant.id);
    },
  };
}
