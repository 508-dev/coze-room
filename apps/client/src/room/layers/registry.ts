import { createAvatarsLayer } from "./avatars";
import { createBackgroundLayer } from "./background";
import { createEnvironmentLayer } from "./environment";
import type { SceneLayerFactory } from "./layer";
import { createLightsLayer } from "./lights";
import { createSeatsLayer } from "./seats";

export const sceneLayers: readonly SceneLayerFactory[] = [
  createEnvironmentLayer,
  createBackgroundLayer,
  createLightsLayer,
  createSeatsLayer,
  createAvatarsLayer,
];
