import type { GuestbookEntry } from "@dormouse/protocol";
import type { ClientFeature } from "./feature";
import { companionsAtWake, lastNightSleepers } from "./guestbook-logic";

/** Feature-owned reactive state stays out of the shared room-state module. */
export class GuestbookFeature {
  entries = $state<GuestbookEntry[]>([]);
  /** The server's "last night" key, used to pick the headline count by date. */
  lastNight = $state("");
  /** Whether the recent-nights detail panel is open. */
  open = $state(false);
  /** Display names shown when the local avatar wakes; bumped to retrigger the fade. */
  wakeNames = $state<string[]>([]);
  wakeSequence = $state(0);

  register: ClientFeature = (state, connection) => {
    const apply = (guestbook: GuestbookEntry[], lastNight: string) => {
      this.entries = guestbook;
      this.lastNight = lastNight;
      state.events.emit("guestbookUpdate", { sleepers: lastNightSleepers(guestbook, lastNight) });
    };
    const offWelcome = connection.on("welcome", ({ guestbook, lastNight }) =>
      apply(guestbook, lastNight),
    );
    // The server pushes this once loading completes, so the first arrival
    // (whose synchronous welcome predates the async store load) still gets it.
    const offGuestbook = connection.on("guestbook", ({ guestbook, lastNight }) =>
      apply(guestbook, lastNight),
    );
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
      state.events.emit("guestbookUpdate", {
        sleepers: lastNightSleepers(this.entries, this.lastNight),
      });
    });
    return () => {
      offWelcome();
      offGuestbook();
      offDozed();
      offClick();
      offRequest();
    };
  };
}
