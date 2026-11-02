import { AudioFeature } from "./audio.svelte";
import { GuestbookFeature } from "./guestbook.svelte";
import { MediaFeature } from "./media.svelte";
import { PhrasesFeature } from "./phrases.svelte";
import { registerPresence } from "./presence";
import { registerSeating } from "./seating";

/** One entry per feature; each app owns fresh state, each connection gets handlers. */
export function createClientFeatures() {
  return {
    presence: { register: registerPresence },
    seating: { register: registerSeating },
    guestbook: new GuestbookFeature(),
    media: new MediaFeature(),
    phrases: new PhrasesFeature(),
    audio: new AudioFeature(),
  };
}
