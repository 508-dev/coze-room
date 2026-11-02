/** Sync is a start timestamp and nothing else. */
export interface MediaState {
  itemId: string | null;
  /** Server wall-clock ms. Clients seek to now - this. */
  startedAt: number;
}

export interface MediaWelcome {
  media: MediaState;
}

export type MediaServerMessage = { t: "media"; media: MediaState };
