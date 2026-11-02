import { object, type Rect, rect } from "./occupants";

export interface EnvironmentSection {
  glass: Rect[];
}
declare module "../packs/manifest" {
  interface PackSections {
    environment?: EnvironmentSection;
  }
}
// Both the audio feature and the art layer can declare the same event safely.
declare module "../events" {
  interface SceneEvents {
    environmentChanged: { id: string };
    environmentRequested: Record<string, never>;
  }
}

export function glassRects(value: unknown, size: [number, number]): Rect[] {
  if (!object(value) || !Array.isArray(value.glass) || !value.glass.every((r) => rect(r, size)))
    return [];
  return value.glass;
}

/** Every rain cell must be in the glass, not merely the start of its streak. */
export function inGlass(x: number, y: number, glass: Rect[]): boolean {
  return glass.some(
    ([left, top, width, height]) => x >= left && y >= top && x < left + width && y < top + height,
  );
}
