export const PHRASE_CATEGORIES = [
  "greeting",
  "goodnight",
  "reaction",
  "request",
  "comfort",
] as const;

export type PhraseCategory = (typeof PHRASE_CATEGORIES)[number];

/**
 * The preset phrase palette: one stable data key per phrase, grouped by
 * category. Audio attaches to these ids later (#18); the visible text lives in
 * the client locale so another language is a drop-in (#21). Keep ids stable
 * once they ship — they are the moderation/audio/transcript keys, not labels.
 */
export const PHRASES = [
  { id: "greeting-hey", category: "greeting" },
  { id: "greeting-hi", category: "greeting" },
  { id: "greeting-hello", category: "greeting" },
  { id: "greeting-welcome", category: "greeting" },
  { id: "greeting-evening", category: "greeting" },

  { id: "goodnight-night", category: "goodnight" },
  { id: "goodnight-sleep-well", category: "goodnight" },
  { id: "goodnight-sweet-dreams", category: "goodnight" },
  { id: "goodnight-see-you-morning", category: "goodnight" },
  { id: "goodnight-rest-easy", category: "goodnight" },
  { id: "goodnight-peaceful-night", category: "goodnight" },

  { id: "reaction-cozy", category: "reaction" },
  { id: "reaction-nice", category: "reaction" },
  { id: "reaction-love", category: "reaction" },
  { id: "reaction-same", category: "reaction" },
  { id: "reaction-heh", category: "reaction" },

  { id: "request-quiet", category: "request" },
  { id: "request-softer", category: "request" },
  { id: "request-join", category: "request" },
  { id: "request-back", category: "request" },
  { id: "request-channel", category: "request" },

  { id: "comfort-safe", category: "comfort" },
  { id: "comfort-stay", category: "comfort" },
  { id: "comfort-breathe", category: "comfort" },
  { id: "comfort-okay", category: "comfort" },
  { id: "comfort-here", category: "comfort" },
] as const satisfies readonly { id: string; category: PhraseCategory }[];

export type PhraseId = (typeof PHRASES)[number]["id"];

const PHRASE_ID_SET: ReadonlySet<string> = new Set(PHRASES.map((p) => p.id));

/** The server validates `say.phraseId` against this list and never relays text. */
export function isPhraseId(value: unknown): value is PhraseId {
  return typeof value === "string" && PHRASE_ID_SET.has(value);
}

/** Client -> server: speak a preset phrase by id. No text crosses the wire. */
export type PhrasesClientMessage = { t: "say"; phraseId: string };

/** Server -> clients: someone spoke. `at` is server wall-clock milliseconds. */
export type PhrasesServerMessage = { t: "said"; id: string; phraseId: string; at: number };
