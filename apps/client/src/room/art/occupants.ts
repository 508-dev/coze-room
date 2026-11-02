import { Assets, Texture } from "pixi.js";

export type Rect = [number, number, number, number];
export interface OccupantSprite {
  seat: string;
  look: string;
  state: "awake" | "asleep";
  breathRow: number;
  headBox: Rect;
}
export interface OccupantsSection {
  looks: string[];
  seats: Record<string, { anchor: [number, number]; pose: string }>;
  sprites: Record<string, OccupantSprite>;
}
declare module "../packs/manifest" {
  interface PackSections {
    occupants?: OccupantsSection;
  }
}

export const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const relativeFile = (value: unknown): value is string =>
  typeof value === "string" &&
  value.split("/").every((part) => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part));
export const rect = (value: unknown, size: readonly number[]): value is Rect =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every(Number.isSafeInteger) &&
  value[0] >= 0 &&
  value[1] >= 0 &&
  value[2] > 0 &&
  value[3] > 0 &&
  value[0] + value[2] <= (size[0] ?? 0) &&
  value[1] + value[3] <= (size[1] ?? 0);

/** Do not trust feature sections just because the core manifest is valid. */
export function occupantsSection(value: unknown, size: [number, number]): OccupantsSection | null {
  if (
    !object(value) ||
    !Array.isArray(value.looks) ||
    !value.looks.length ||
    !value.looks.every((look) => typeof look === "string" && /^[\w-]+$/.test(look)) ||
    !object(value.seats) ||
    !object(value.sprites)
  )
    return null;
  for (const seat of Object.values(value.seats)) {
    if (
      !object(seat) ||
      !Array.isArray(seat.anchor) ||
      seat.anchor.length !== 2 ||
      !seat.anchor.every((n, i) => Number.isSafeInteger(n) && n >= 0 && n < (size[i] ?? 0))
    )
      return null;
  }
  for (const [file, sprite] of Object.entries(value.sprites)) {
    if (
      !relativeFile(file) ||
      !object(sprite) ||
      typeof sprite.seat !== "string" ||
      !Object.hasOwn(value.seats, sprite.seat) ||
      !value.looks.includes(sprite.look) ||
      !["awake", "asleep"].includes(String(sprite.state)) ||
      !Number.isSafeInteger(sprite.breathRow) ||
      Number(sprite.breathRow) <= 0 ||
      Number(sprite.breathRow) >= size[1] ||
      !rect(sprite.headBox, size)
    )
      return null;
  }
  return value as unknown as OccupantsSection;
}

export async function loadOccupantTextures(
  baseUrl: string,
  section: OccupantsSection,
  size: [number, number],
) {
  return new Map(
    await Promise.all(
      Object.keys(section.sprites).map(async (file) => {
        const texture: unknown = await Assets.load(`${baseUrl}${file}`);
        if (
          !(texture instanceof Texture) ||
          texture.width !== size[0] ||
          texture.height !== size[1]
        ) {
          throw new Error(`invalid occupant texture: ${file}`);
        }
        texture.source.scaleMode = "nearest";
        return [file, texture] as const;
      }),
    ),
  );
}
