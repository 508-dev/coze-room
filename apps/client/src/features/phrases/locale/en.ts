import type { PhraseCategory, PhraseId } from "@dormouse/protocol";

/**
 * English locale for the preset phrases. Text is keyed by the stable phrase id
 * so another language drops in later (#21) and the server never sees a word of
 * it. Keep every string short, warm and lowercase — this is a room of people
 * drifting off, not a forum.
 */
export const enPhrases: Record<PhraseId, string> = {
  "greeting-hey": "hey",
  "greeting-hi": "hi there",
  "greeting-hello": "hello",
  "greeting-welcome": "welcome in",
  "greeting-evening": "good evening",

  "goodnight-night": "night night",
  "goodnight-sleep-well": "sleep well",
  "goodnight-sweet-dreams": "sweet dreams",
  "goodnight-see-you-morning": "see you in the morning",
  "goodnight-rest-easy": "rest easy",
  "goodnight-peaceful-night": "peaceful night",

  "reaction-cozy": "this is cozy",
  "reaction-nice": "nice",
  "reaction-love": "love this",
  "reaction-same": "same",
  "reaction-heh": "heh",

  "request-quiet": "mind if we go quiet?",
  "request-softer": "could the tv go softer?",
  "request-join": "room for one more?",
  "request-back": "be right back",
  "request-channel": "change the channel?",

  "comfort-safe": "you're safe here",
  "comfort-stay": "stay as long as you like",
  "comfort-breathe": "breathe easy",
  "comfort-okay": "it's okay",
  "comfort-here": "i'm here",
};

export const enCategoryLabels: Record<PhraseCategory, string> = {
  greeting: "greeting",
  goodnight: "goodnight",
  reaction: "reaction",
  request: "request",
  comfort: "comfort",
};

/** Resolve a wire phrase id to local text, or undefined for ids this client doesn't know. */
export function phraseText(id: string): string | undefined {
  return Object.hasOwn(enPhrases, id) ? enPhrases[id as PhraseId] : undefined;
}
