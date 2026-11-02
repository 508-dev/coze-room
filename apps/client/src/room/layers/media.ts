import { AnimatedGIF } from "@pixi/gif";
import { Container, Graphics, Rectangle, Ticker } from "pixi.js";
import { tvScreen } from "../../features/media-pack";
import type { LayerContext, SceneLayer } from "./layer";

/** A tiny looping excerpt, not a second full-film decoder. All time comes from Scene. */
export function createMediaLayer(): SceneLayer {
  const tv = new Container();
  const frame = tv.addChild(new Graphics());
  const clock = new Ticker();
  let context: LayerContext;
  let screen = tvScreen();
  let gif: AnimatedGIF | null = null;
  let url: string | null = null;
  let request: AbortController | null = null;
  let remove: (() => void) | undefined;
  let generation = 0;

  const layout = () => {
    const [x, y, w, h] = screen;
    tv.position.set(x, y);
    tv.hitArea = new Rectangle(-4, -4, w + 8, h + 8);
    frame
      .clear()
      .rect(-4, -4, w + 8, h + 8)
      .fill(0x332b40)
      .rect(0, 0, w, h)
      .fill(0x171620);
    if (gif) {
      const fit = Math.min(w / gif.texture.width, h / gif.texture.height);
      const scale = fit >= 1 ? Math.floor(fit) : fit;
      gif.scale.set(scale);
      gif.position.set(Math.floor((w - gif.width) / 2), Math.floor((h - gif.height) / 2));
    } else {
      // Quiet off indicator; all words stay in the DOM.
      frame.rect(w - 6, h - 4, 2, 1).fill(0x787d72);
    }
  };

  const preview = async (next: string | null) => {
    if (next === url) return;
    url = next;
    const version = ++generation;
    request?.abort();
    gif?.destroy(); // fromBuffer owns its texture; never destroys pack/shared textures.
    gif = null;
    layout();
    if (!next) return;
    request = new AbortController();
    try {
      const response = await fetch(next, { signal: request.signal });
      if (!response.ok) return;
      const buffer = await response.arrayBuffer();
      if (version !== generation) return;
      gif = AnimatedGIF.fromBuffer(buffer, { scaleMode: "nearest", autoUpdate: false });
      gif.dirty = true;
      tv.addChild(gif);
      layout();
    } catch {
      // An unavailable mirror is a resting TV, never a broken room.
    }
  };

  return {
    slot: "furnitureFront",
    attach(value) {
      context = value;
      context.container.addChild(tv);
      tv.eventMode = "static";
      tv.cursor = "pointer";
      tv.on("pointertap", () => context.events.emit("tvClick", undefined));
      remove = context.events.on("mediaPreview", ({ url }) => {
        void preview(url);
      });
      layout();
      context.events.emit("mediaPreviewRequest", undefined);
    },
    onRoomChange(_room, pack) {
      screen = tvScreen(pack?.manifest);
      layout();
    },
    update(_dt, now) {
      clock.update(now);
      gif?.update(clock);
    },
    destroy() {
      ++generation;
      request?.abort();
      remove?.();
      gif?.destroy();
      gif = null;
      clock.destroy();
    },
  };
}
