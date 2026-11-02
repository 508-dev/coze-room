import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MediaItem } from "@dormouse/protocol";

export const MEDIA_CATALOGUE_PATH = fileURLToPath(
  new URL("../../../../catalogue/manifest.json", import.meta.url),
);
// Several rooms may encounter the same broken deployment. Warn once, not on every join/tick.
const warnedPaths = new Set<string>();

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Runtime metadata is optional infrastructure: a bad catalogue must never take down presence. */
export function loadMediaCatalogue(path = MEDIA_CATALOGUE_PATH): MediaItem[] {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!record(value) || value.schemaVersion !== 1 || !Array.isArray(value.items)) {
      throw new Error("Expected catalogue schemaVersion 1 and an items array");
    }
    const ids = new Set<string>();
    const items = value.items.map((item): MediaItem => {
      if (
        !record(item) ||
        typeof item.id !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) ||
        ids.has(item.id) ||
        typeof item.title !== "string" ||
        !item.title.trim() ||
        typeof item.year !== "number" ||
        !Number.isSafeInteger(item.year) ||
        item.year < 0 ||
        typeof item.silent !== "boolean" ||
        typeof item.durationSeconds !== "number" ||
        !Number.isSafeInteger(Math.round(item.durationSeconds * 1000)) ||
        Math.round(item.durationSeconds * 1000) <= 0 ||
        typeof item.licence !== "string" ||
        !item.licence.trim() ||
        (item.attribution !== undefined &&
          (typeof item.attribution !== "string" || !item.attribution.trim()))
      ) {
        throw new Error("Invalid or duplicate media catalogue item");
      }
      ids.add(item.id);
      return {
        id: item.id,
        title: item.title,
        year: item.year,
        silent: item.silent,
        durationSeconds: item.durationSeconds,
        licence: item.licence,
        ...(typeof item.attribution === "string" ? { attribution: item.attribution } : {}),
      };
    });
    if (
      !Number.isSafeInteger(
        items.reduce((sum, item) => sum + Math.round(item.durationSeconds * 1000), 0),
      )
    ) {
      throw new Error("Media catalogue cycle is too long");
    }
    return items;
  } catch (error) {
    if (!warnedPaths.has(path)) {
      warnedPaths.add(path);
      console.warn("Could not load media catalogue; the TV is off.", error);
    }
    return [];
  }
}
