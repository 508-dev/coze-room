import { createAvatarsLayer } from "./avatars";
import { createBackgroundLayer } from "./background";
import { createBubblesLayer } from "./bubbles";
import { createEnvironmentLayer } from "./environment";
import type { SceneLayerFactory } from "./layer";
import { createLightsLayer } from "./lights";
import { createMediaLayer } from "./media";
import { createSeatsLayer } from "./seats";

export const sceneLayers: readonly SceneLayerFactory[] = [
  createEnvironmentLayer,
  createBackgroundLayer,
  createLightsLayer,
  createSeatsLayer,
  createAvatarsLayer,
  createMediaLayer,
  createBubblesLayer,
];
