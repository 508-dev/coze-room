import type { GuestbookEntry } from "@dormouse/protocol";
import type { ClientFeature } from "./feature";
import { companionsAtWake } from "./guestbook-logic";

/** Feature-owned reactive state stays out of the shared room-state module. */
export class GuestbookFeature {
  entries = $state<GuestbookEntry[]>([]);
  /** Whether the recent-nights detail panel is open. */
  open = $state(false);
  /** Display names shown when the local avatar wakes; bumped to retrigger the fade. */
  wakeNames = $state<string[]>([]);
  wakeSequence = $state(0);

  register: ClientFeature = (state, connection) => {
    const offWelcome = connection.on("welcome", ({ guestbook }) => {
      this.entries = guestbook;
      state.events.emit("guestbookUpdate", { sleepers: guestbook[0]?.sleepers ?? null });
    });
    const offDozed = connection.on("dozed", ({ id, asleep }) => {
      if (id === state.selfId && !asleep) {
        this.wakeNames = companionsAtWake(state.occupants, state.selfId ?? "");
        this.wakeSequence += 1;
      }
    });
    const offClick = state.events.on("guestbookClick", () => {
      this.open = !this.open;
    });
    // The scene layer may attach after the welcome already arrived; answer it.
    const offRequest = state.events.on("guestbookRequest", () => {
      state.events.emit("guestbookUpdate", { sleepers: this.entries[0]?.sleepers ?? null });
    });
    return () => {
      offWelcome();
      offDozed();
      offClick();
      offRequest();
    };
  };
}
