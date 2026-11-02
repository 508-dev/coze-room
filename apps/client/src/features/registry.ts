import { GuestbookFeature } from "./guestbook.svelte";
import { registerPresence } from "./presence";
import { registerSeating } from "./seating";

/** One entry per feature; each app owns fresh state, each connection gets handlers. */
export function createClientFeatures() {
  return {
    presence: { register: registerPresence },
    seating: { register: registerSeating },
    guestbook: new GuestbookFeature(),
  };
}
