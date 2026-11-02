import { Container, Graphics, Sprite } from "pixi.js";
import { glassRects, inGlass } from "../art/environment";
import { observeReducedMotion } from "../art/motion";
import type { Rect } from "../art/occupants";
import type { LoadedPack } from "../packs/loader";
import type { SceneLayer } from "./layer";

export function createEnvironmentLayer(): SceneLayer {
  const container = new Container({ eventMode: "none" });
  const weather = new Graphics();
  let pack: LoadedPack | null = null;
  let glass: Rect[] = [];
  let environment = "";
  let reduced = false;
  let frame = -1;
  let offEnvironment = () => {};
  let offMotion = () => {};

  function select() {
    for (const child of container.removeChildren()) {
      if (child !== weather) child.destroy();
    }
    if (pack) {
      const texture = pack.windowViews[environment] ?? Object.values(pack.windowViews)[0];
      if (texture) container.addChild(new Sprite(texture));
    }
    container.addChild(weather);
    frame = -1;
    weather.clear();
  }

  return {
    slot: "windowView",
    attach({ container: slot, events }) {
      slot.addChild(container);
      offEnvironment = events.on("environmentChanged", ({ id }) => {
        environment = id;
        select();
      });
      offMotion = observeReducedMotion((value) => {
        reduced = value;
        frame = -1;
      });
    },
    onRoomChange(_room, nextPack) {
      pack = nextPack;
      glass = pack ? glassRects(pack.manifest.sections?.environment, pack.manifest.room.size) : [];
      select();
    },
    update(_dt, now) {
      const next = Math.floor(now / 100); // at most 10 tiny geometry rebuilds/sec; no independent timers.
      if (next === frame) return;
      frame = next;
      weather.clear();
      if (reduced || !pack || !glass.length) return;
      const active = Object.hasOwn(pack.windowViews, environment)
        ? environment
        : Object.keys(pack.windowViews)[0];
      const [width, height] = pack.manifest.room.size;
      if (active === "rain") {
        for (let i = 0; i < 36; i++) {
          const x = (i * 17 + Math.floor(next / 3)) % width;
          const y = (i * 29 + next) % height;
          for (let cell = 0; cell < 3; cell++) {
            if (inGlass(x, y + cell, glass)) weather.rect(x, y + cell, 1, 1);
          }
        }
        weather.fill(0x539799);
      } else if (active === "clear-night") {
        for (let i = 0; i < 16; i++) {
          const x = (i * 23 + 41) % width;
          const y = (i * 7 + 13) % height;
          if ((Math.floor(next / 15) + i) % 4 === 0 && inGlass(x, y, glass))
            weather.rect(x, y, 1, 1);
        }
        weather.fill(0xa1b9a7);
      }
    },
    destroy() {
      offEnvironment();
      offMotion();
    },
  };
}
