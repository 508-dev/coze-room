import { isPhraseId } from "@dormouse/protocol";
import type { RoomFeature } from "./feature";
import { RateLimiter } from "./rate-limit";

/** Sustained rate: one phrase per three seconds, with a small burst up front. */
const SAY_BURST = 3;
const SAY_REFILL_MS = 3_000;

export function createPhrasesFeature(): RoomFeature {
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
  };
}
