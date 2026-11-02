export interface GuestbookEntry {
  /** ISO date of the night, keyed to local server midnight. */
  date: string;
  sleepers: number;
  sleeperHours: number;
}

export interface GuestbookWelcome {
  guestbook: GuestbookEntry[];
  /**
   * The server's local-midnight key of the most recent completed night. The
   * client selects "last night" by this key, so a night with no sleepers reads
   * zero rather than falling back to an older count.
   */
  lastNight: string;
}

/** Pushed after the welcome once the store finishes loading/refreshing. */
export type GuestbookServerMessage = {
  t: "guestbook";
  guestbook: GuestbookEntry[];
  lastNight: string;
};
