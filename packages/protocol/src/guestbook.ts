export interface GuestbookEntry {
  /** ISO date of the night, keyed to local server midnight. */
  date: string;
  sleepers: number;
  sleeperHours: number;
}

export interface GuestbookWelcome {
  guestbook: GuestbookEntry[];
}
