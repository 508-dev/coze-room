/** Sync is a start timestamp and nothing else. */
export interface MediaState {
  itemId: string | null;
  /** Server wall-clock ms. Clients seek to now - this. */
  startedAt: number;
}

export interface MediaWelcome {
  media: MediaState;
  /** Optional for compatibility with older servers / rooms without this feature. */
  mediaCatalogue?: MediaItem[];
  mediaServerNow?: number;
}

/** Public metadata only. Source files and ingest tooling never go to the client. */
export interface MediaItem {
  id: string;
  title: string;
  year: number;
  silent: boolean;
  durationSeconds: number;
  licence: string;
  attribution?: string;
}

export type MediaClientMessage = { t: "mediaSync"; sentAt: number };
export type MediaServerMessage = {
  t: "media";
  media: MediaState;
  serverNow: number;
  /** Echo for an approximate round-trip clock sample, not a playback command. */
  sentAt?: number;
};
