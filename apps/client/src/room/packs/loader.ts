import { Assets, Texture } from "pixi.js";
import { isPackId, type PackManifest, validateManifest } from "./manifest";

export interface LoadedPack {
  manifest: PackManifest;
  /** Resolve feature-owned, validated relative asset paths against this URL. */
  baseUrl: string;
  background: Texture;
  windowViews: Record<string, Texture>;
}

const PACK_BASE = import.meta.env.VITE_PACK_BASE_URL ?? "/packs";

async function texture(url: string): Promise<Texture> {
  const asset: unknown = await Assets.load(url);
  if (!(asset instanceof Texture)) throw new Error(`not a texture: ${url}`);
  asset.source.scaleMode = "nearest";
  return asset;
}

/** Assets are shared/cached by Pixi. Layers destroy sprites, never shared textures. */
export async function loadPack(id: string, base = PACK_BASE): Promise<LoadedPack | null> {
  try {
    if (!isPackId(id)) throw new Error("invalid pack id");
    const baseUrl = `${base.replace(/\/+$/, "")}/${id}/`;
    const manifest = validateManifest(await Assets.load<unknown>(`${baseUrl}manifest.json`));
    if (manifest.id !== id) throw new Error("pack id does not match its directory");
    const background = await texture(`${baseUrl}${manifest.room.background}`);
    const views = await Promise.all(
      Object.entries(manifest.room.windowViews ?? {}).map(
        async ([env, file]) => [env, await texture(`${baseUrl}${file}`)] as const,
      ),
    );
    return { manifest, baseUrl, background, windowViews: Object.fromEntries(views) };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: failed packs must visibly warn and fall back.
    console.warn(`Could not load pack "${id}"; using placeholder room.`, error);
    return null;
  }
}
