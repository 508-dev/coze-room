import { createAvatarsLayer } from "./avatars";
import { createBackgroundLayer } from "./background";
import { createEnvironmentLayer } from "./environment";
import { createGuestbookLayer } from "./guestbook";
import type { SceneLayerFactory } from "./layer";
import { createLightsLayer } from "./lights";
import { createMediaLayer } from "./media";
import { createSeatsLayer } from "./seats";

export const sceneLayers: readonly SceneLayerFactory[] = [
  createEnvironmentLayer,
  createBackgroundLayer,
  createLightsLayer,
  createSeatsLayer,
  createGuestbookLayer,
  createAvatarsLayer,
  createMediaLayer,
];
