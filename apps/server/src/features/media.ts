import type { MediaItem, MediaState } from "@dormouse/protocol";
import catalogue from "../../../../catalogue/manifest.json";
import type { Room } from "../room";
import type { RoomFeature } from "./feature";
import { shelfAt } from "./media-playlist";

export const MEDIA_CATALOGUE: MediaItem[] = catalogue.items.map((item) => ({
  id: item.id,
  title: item.title,
  year: item.year,
  silent: item.silent,
  durationSeconds: item.durationSeconds,
  licence: item.licence,
  ...(item.attribution ? { attribution: item.attribution } : {}),
}));

export function createMediaFeature(items = MEDIA_CATALOGUE): RoomFeature {
  let current: MediaState | null = null;
  const advance = (room: Room, now: number) => {
    const next = shelfAt(items, now);
    if (next.itemId !== current?.itemId || next.startedAt !== current?.startedAt) {
      const announce = current !== null;
      current = next;
      if (announce) room.broadcast({ t: "media", media: next, serverNow: now });
    }
    return next;
  };
  return {
    welcome(room) {
      const now = Date.now();
      return { media: advance(room, now), mediaCatalogue: items, mediaServerNow: now };
    },
    onTick: advance,
    onMessage(room, id, message) {
      if (message.t !== "mediaSync") return;
      if (typeof message.sentAt !== "number" || !Number.isFinite(message.sentAt)) return true;
      const now = Date.now();
      room.send(id, {
        t: "media",
        media: advance(room, now),
        serverNow: now,
        sentAt: message.sentAt,
      });
      return true;
    },
  };
}
