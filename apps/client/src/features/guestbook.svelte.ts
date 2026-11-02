import type { GuestbookEntry } from "@dormouse/protocol";
import type { ClientFeature } from "./feature";

/** Feature-owned reactive state stays out of the shared room-state module. */
export class GuestbookFeature {
  entries = $state<GuestbookEntry[]>([]);

  register: ClientFeature = (_state, connection) =>
    connection.on("welcome", ({ guestbook }) => {
      this.entries = guestbook;
    });
}
