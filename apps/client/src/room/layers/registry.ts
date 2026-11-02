import { createAvatarsLayer } from "./avatars";
import { createBackgroundLayer } from "./background";
import type { SceneLayerFactory } from "./layer";
import { createSeatsLayer } from "./seats";

export const sceneLayers: readonly SceneLayerFactory[] = [
  createBackgroundLayer,
  createSeatsLayer,
  createAvatarsLayer,
];
