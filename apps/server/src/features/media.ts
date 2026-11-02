import type { MediaItem, MediaState } from "@dormouse/protocol";
import type { Room } from "../room";
import type { RoomFeature } from "./feature";
import { loadMediaCatalogue, MEDIA_CATALOGUE_PATH } from "./media-catalogue";
import { shelfAt } from "./media-playlist";

export function createMediaFeature(
  items?: MediaItem[],
  cataloguePath = MEDIA_CATALOGUE_PATH,
): RoomFeature {
  const catalogue = items ?? loadMediaCatalogue(cataloguePath);
  let current: MediaState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scheduledAt: number | undefined;
  const cancelBoundary = () => {
    clearTimeout(timer);
    timer = undefined;
    scheduledAt = undefined;
  };
  const advance = (room: Room, now: number) => {
    const next = shelfAt(catalogue, now);
    if (next.itemId !== current?.itemId || next.startedAt !== current?.startedAt) {
      const announce = current !== null;
      current = next;
      if (announce) room.broadcast({ t: "media", media: next, serverNow: now });
    }
    const item = catalogue.find((item) => item.id === next.itemId);
    if (!item || room.occupants.length === 0) {
      cancelBoundary();
    } else {
      const boundary = next.startedAt + Math.round(item.durationSeconds * 1000);
      if (boundary !== scheduledAt) {
        cancelBoundary();
        scheduledAt = boundary;
        timer = setTimeout(
          () => {
            timer = undefined;
            scheduledAt = undefined;
            advance(room, Date.now());
          },
          Math.max(1, Math.min(boundary - now, 2_147_483_647)),
        );
        timer.unref?.();
      }
    }
    return next;
  };
  return {
    welcome(room) {
      const now = Date.now();
      return { media: advance(room, now), mediaCatalogue: catalogue, mediaServerNow: now };
    },
    onTick: advance,
    onLeave(room) {
      if (room.occupants.length === 0) cancelBoundary();
    },
    destroy: cancelBoundary,
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
