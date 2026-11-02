import { Container, Graphics } from "pixi.js";
import { observeReducedMotion } from "../art/motion";
import type { SceneLayer } from "./layer";

/** Palette cycling, not alpha/glow blending: output remains in Atropoeia exactly.
 * At 128x72 a few highlight cells are cheaper than an offscreen full-canvas filter.
 */
export function createLightsLayer(): SceneLayer {
  const container = new Container({ eventMode: "none" });
  const highlights = new Graphics();
  let warm: [number, number][] = [];
  let cool: [number, number][] = [];
  let reduced = false;
  let frame = -1;
  let offMotion = () => {};
  container.addChild(highlights);
  return {
    slot: "furnitureBack",
    attach({ container: slot }) {
      slot.addChild(container);
      offMotion = observeReducedMotion((value) => {
        reduced = value;
        frame = -1;
      });
    },
    onRoomChange(_room, pack) {
      highlights.clear();
      warm = [];
      cool = [];
      frame = -1;
      if (!pack || typeof document === "undefined") return;
      const [width, height] = pack.manifest.room.size;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      try {
        context.drawImage(pack.background.source.resource as CanvasImageSource, 0, 0);
        const pixels = context.getImageData(0, 0, width, height).data;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            if (pixels[offset + 3] !== 255) continue;
            const colour =
              ((pixels[offset] ?? 0) << 16) |
              ((pixels[offset + 1] ?? 0) << 8) |
              (pixels[offset + 2] ?? 0);
            if (colour === 0xd1c784) warm.push([x, y]);
            if (colour === 0x3f7887) cool.push([x, y]);
          }
      } catch {
        // Cross-origin packs without CORS still render; only this optional highlight effect is disabled.
      }
    },
    update(_dt, now) {
      const next = Math.floor(now / 700);
      if (frame === next) return;
      frame = next;
      highlights.clear();
      if (reduced) return;
      if (next % 7 === 0) {
        for (const [x, y] of warm) highlights.rect(x, y, 1, 1);
        highlights.fill(0xcdb75f);
      }
      if (next % 5 === 0) {
        for (const [x, y] of cool) highlights.rect(x, y, 1, 1);
        highlights.fill(0x539799);
      }
    },
    destroy() {
      offMotion();
    },
  };
}
