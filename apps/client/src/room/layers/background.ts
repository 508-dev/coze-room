import { Container, Graphics, Sprite } from "pixi.js";
import { PLACEHOLDER_SIZE } from "../space";
import type { SceneLayer } from "./layer";

export function createBackgroundLayer(): SceneLayer {
  const background = new Container();
  return {
    // The room painting may contain transparent window cut-outs. Draw it AFTER
    // windowView; the background slot is reserved for a base beneath both.
    slot: "furnitureBack",
    attach({ container }) {
      container.addChild(background);
    },
    onRoomChange(_room, pack) {
      for (const child of background.removeChildren()) child.destroy();
      if (pack) {
        const sprite = new Sprite(pack.background);
        [sprite.width, sprite.height] = pack.manifest.room.size;
        background.addChild(sprite);
      } else {
        background.addChild(new Graphics().rect(0, 0, ...PLACEHOLDER_SIZE).fill(0x140f1e));
      }
    },
    destroy() {},
  };
}
