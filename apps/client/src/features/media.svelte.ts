import type { MediaItem, MediaState } from "@dormouse/protocol";
import type { ClientFeature } from "./feature";
import { clockOffset, mediaUrl, seekSeconds } from "./media-playback";

declare module "../room/events" {
  interface SceneEvents {
    tvClick: undefined;
    mediaPreview: { url: string | null };
    mediaPreviewRequest: undefined;
  }
}

export class MediaFeature {
  catalogue = $state<MediaItem[]>([]);
  current = $state<MediaState>({ itemId: null, startedAt: 0 });
  offset = $state(0);
  watchOpen = $state(false);
  /** Native controls are local, and must not jump back to full volume on drift-off. */
  readonly audioSettings = { volume: 1, muted: false };
  readonly base = import.meta.env.VITE_MEDIA_BASE_URL?.trim() ?? "";
  item = $derived(this.catalogue.find((item) => item.id === this.current.itemId));

  position = () =>
    seekSeconds(this.current, this.item?.durationSeconds ?? 0, Date.now(), this.offset);

  register: ClientFeature = (state, connection) => {
    this.watchOpen = false;
    this.catalogue = [];
    this.current = { itemId: null, startedAt: 0 };
    const preview = () =>
      state.events.emit("mediaPreview", {
        url: state.drifting || !this.item ? null : mediaUrl(this.base, this.item.id, "gif"),
      });
    let pending: number | undefined;
    const sample = () => {
      pending = Date.now();
      connection.send({ t: "mediaSync", sentAt: pending });
    };
    const remove = [
      connection.on("welcome", (message) => {
        this.catalogue = message.mediaCatalogue ?? [];
        this.current = message.media;
        if (message.mediaServerNow !== undefined)
          this.offset = clockOffset(message.mediaServerNow, Date.now());
        sample();
      }),
      connection.on("media", (message) => {
        this.current = message.media;
        const received = Date.now();
        const sent = message.sentAt === pending ? pending : undefined;
        this.offset = clockOffset(message.serverNow, received, sent);
        if (sent !== undefined) pending = undefined;
      }),
      state.events.on("tvClick", () => {
        state.wake();
        this.watchOpen = true;
      }),
      state.events.on("mediaPreviewRequest", preview),
      $effect.root(() => {
        $effect(preview);
      }),
    ];
    const timer = setInterval(sample, 30_000);
    return () => {
      clearInterval(timer);
      for (const cleanup of remove) cleanup();
      this.watchOpen = false;
      this.current = { itemId: null, startedAt: 0 };
      this.catalogue = [];
      preview();
    };
  };
}
