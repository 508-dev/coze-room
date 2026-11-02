export interface PublicRoomSummary {
  id: string;
  name: string;
  occupants: number;
  capacity: number;
  asleep: number;
}

export interface PrivateRoomCreated {
  roomId: string;
  code: string;
}

/** Codes are case-insensitive and may be typed with spaces instead of hyphens. */
export function normalizePrivateCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "-");
}
