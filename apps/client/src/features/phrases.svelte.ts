import type { PhraseId } from "@dormouse/protocol";
import type { RoomState } from "../state/room.svelte";
import type { ClientFeature } from "./feature";
import { phraseText } from "./phrases/locale/en";

/** The canvas-side payload the bubbles layer renders. Text is already resolved. */
export interface PhraseEvent {
  id: string;
  phraseId: string;
  text: string;
  at: number;
}

declare module "../room/events" {
  interface SceneEvents {
    phrase: PhraseEvent;
  }
}

/**
 * Owns the local phrase palette state and forwards server `said` echoes to the
 * bubbles layer. Resolving text here keeps the layer language-agnostic.
 */
export class PhrasesFeature {
  open = $state(false);
  private state: RoomState | null = null;

  register: ClientFeature = (state, connection) => {
    this.state = state;
    return connection.on("said", ({ id, phraseId, at }) => {
      const text = phraseText(phraseId);
      // A phrase this client does not know (newer server) is dropped gracefully.
      if (text === undefined) return;
      state.events.emit("phrase", { id, phraseId, text, at });
    });
  };

  say(phraseId: PhraseId): void {
    if (!this.state) return;
    this.state.wake();
    this.state.send({ t: "say", phraseId });
  }

  toggle(): void {
    this.open = !this.open;
  }
}
