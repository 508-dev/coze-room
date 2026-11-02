import type { PackManifest } from "../room/packs/manifest";

export type ScreenRect = [number, number, number, number];

declare module "../room/packs/manifest" {
  interface PackSections {
    tv?: { screen: ScreenRect };
  }
}

/** Room-space integers, wholly inside the room. Untrusted sections are feature-validated. */
export function tvScreen(pack?: PackManifest): ScreenRect {
  const [width, height] = pack?.room.size ?? [640, 360];
  const section: unknown = pack?.sections?.tv;
  if (typeof section === "object" && section !== null && "screen" in section) {
    const rect = section.screen;
    if (Array.isArray(rect) && rect.length === 4 && rect.every(Number.isSafeInteger)) {
      const [x, y, w, h] = rect as ScreenRect;
      if (x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height) {
        return [x, y, w, h];
      }
    }
  }
  const w = Math.min(96, width);
  const h = Math.min(54, height);
  return [Math.max(0, Math.min(462, width - w)), Math.max(0, Math.min(116, height - h)), w, h];
}
