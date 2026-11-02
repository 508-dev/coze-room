import { describe, expect, it } from "vitest";
import { isPhraseId, PHRASE_CATEGORIES, PHRASES } from "./phrases";

describe("phrase palette data", () => {
  it("ships a v0.1 subset across all five categories", () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(20);
    expect(PHRASES.length).toBeLessThanOrEqual(50);
    for (const category of PHRASE_CATEGORIES) {
      expect(PHRASES.filter((p) => p.category === category).length).toBeGreaterThan(0);
    }
  });

  it("uses unique, kebab-case, category-prefixed ids", () => {
    const seen = new Set<string>();
    for (const { id, category } of PHRASES) {
      expect(id).toMatch(/^[a-z]+-[a-z0-9-]+$/);
      expect(id.startsWith(`${category}-`)).toBe(true);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it("only accepts ids from the shared list", () => {
    for (const { id } of PHRASES) expect(isPhraseId(id)).toBe(true);
    expect(isPhraseId("greeting-not-a-real-phrase")).toBe(false);
    expect(isPhraseId("")).toBe(false);
    expect(isPhraseId(42)).toBe(false);
    expect(isPhraseId(null)).toBe(false);
    expect(isPhraseId(undefined)).toBe(false);
  });
});
