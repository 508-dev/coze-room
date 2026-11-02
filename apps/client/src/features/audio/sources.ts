import type { EnvironmentId } from "@dormouse/protocol";
import type { LoadedPack } from "../../room/packs/loader";

export interface BedSources {
  ogg: string;
  m4a: string;
}

export type AudioSourceId = "ambient" | "tv";

type AudioPack = Pick<LoadedPack, "baseUrl" | "manifest">;

declare module "../../room/packs/manifest" {
  interface PackSections {
    audio?: {
      beds: Record<string, { ogg: string; m4a: string }>;
    };
  }
}

const PACK_BASE = import.meta.env.VITE_PACK_BASE_URL ?? "/packs";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Feature assets obey the same pack-relative, no-hotlink rules as core art. */
function file(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.split("/").every((part) => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part))
  );
}

function validBeds(value: unknown): value is Record<string, { ogg: string; m4a: string }> {
  return (
    object(value) &&
    Object.values(value).every((bed) => object(bed) && file(bed.ogg) && file(bed.m4a))
  );
}

/** Resolve the active pack's validated section, or the v0.1 conventional paths. */
export function resolveBedSources(
  pack: AudioPack | null,
  environment: EnvironmentId,
  packBase = PACK_BASE,
): BedSources {
  const fallbackBase = `${packBase.replace(/\/+$/, "")}/dormouse-v0/audio/${environment}`;
  const section = pack?.manifest.sections?.audio;
  if (pack && object(section) && validBeds(section.beds)) {
    const bed = section.beds[environment];
    if (bed) {
      return {
        ogg: `${pack.baseUrl}${bed.ogg}`,
        m4a: `${pack.baseUrl}${bed.m4a}`,
      };
    }
  }
  return { ogg: `${fallbackBase}.ogg`, m4a: `${fallbackBase}.m4a` };
}

/** Prefer Opus, with AAC for browsers (notably older Safari) that cannot decode it. */
export function selectBedSource(
  sources: BedSources,
  canPlayType: (mimeType: string) => string,
): string {
  return canPlayType('audio/ogg; codecs="opus"') !== "" ? sources.ogg : sources.m4a;
}
