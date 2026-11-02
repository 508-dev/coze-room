<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { drawBubble } from "../features/bubble-render";
import {
  avatarHead,
  BUBBLE_SCALE,
  BUBBLE_TAIL_H,
  bubbleAlpha,
  bubbleExpired,
  layoutBubble,
  toScreen,
  withinThrottle,
} from "../features/bubbles";
import type { RoomTransform } from "../room/events";
import type { RoomState } from "../state/room.svelte";

const { state: roomState }: { state: RoomState } = $props();

interface Bubble {
  id: string;
  key: number;
  text: string;
  left: number;
  top: number;
  cssWidth: number;
  cssHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  tailX: number;
  bornAt: number;
  alpha: number;
}

let transform = $state<RoomTransform | null>(null);
let bubbles = $state<Bubble[]>([]);
let liveText = $state("");
let lastAnnouncedAt: number | null = null;
let off: Array<() => void> = [];
let raf = 0;
let running = false;
let seq = 0;

function show(id: string, text: string): void {
  if (!transform) return;
  const head = avatarHead(
    roomState.occupants.find((o) => o.id === id),
    roomState.room,
  );
  if (!head) return;
  const screen = toScreen(head, transform);
  const layout = layoutBubble(screen, text, { width: transform.width, height: transform.height });
  // bornAt is the receipt time, not the first paint: a phrase received while
  // the tab was hidden must not come back with a fresh lifetime.
  const bubble: Bubble = {
    id,
    key: seq++,
    text,
    left: layout.left,
    top: layout.top,
    cssWidth: layout.width,
    cssHeight: layout.height + BUBBLE_TAIL_H * BUBBLE_SCALE,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    tailX: layout.tailX,
    bornAt: performance.now(),
    alpha: 1,
  };
  const index = bubbles.findIndex((b) => b.id === id);
  if (index >= 0) bubbles[index] = bubble;
  else bubbles.push(bubble);
  announce(id, text);
  start();
}

function announce(id: string, text: string): void {
  const now = performance.now();
  if (withinThrottle(lastAnnouncedAt, now)) return;
  lastAnnouncedAt = now;
  const name = roomState.occupants.find((o) => o.id === id)?.name ?? "someone";
  liveText = `${name}: ${text}`;
}

function start(): void {
  if (running) return;
  running = true;
  const tick = (now: number) => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bubble = bubbles[i];
      if (!bubble) continue;
      const elapsed = now - bubble.bornAt;
      if (bubbleExpired(elapsed)) {
        bubbles.splice(i, 1);
        continue;
      }
      const alpha = bubbleAlpha(elapsed);
      if (alpha !== bubble.alpha) bubbles[i] = { ...bubble, alpha };
    }
    if (bubbles.length > 0) raf = requestAnimationFrame(tick);
    else running = false;
  };
  raf = requestAnimationFrame(tick);
}

function draw(canvas: HTMLCanvasElement, bubble: Bubble): void {
  canvas.width = bubble.canvasWidth;
  canvas.height = bubble.canvasHeight;
  drawBubble(canvas, bubble.text, bubble.tailX);
}

onMount(() => {
  off = [
    roomState.events.on("roomTransform", (value) => {
      transform = value;
    }),
    roomState.events.on("phrase", ({ id, text }) => show(id, text)),
  ];
});

onDestroy(() => {
  for (const remove of off) remove();
  cancelAnimationFrame(raf);
});
</script>

<div class="bubbles" aria-hidden="true">
  {#each bubbles as bubble (bubble.key)}
    <div
      class="bubble"
      style:left="{bubble.left}px"
      style:top="{bubble.top}px"
      style:opacity={bubble.alpha}
    >
      <canvas
        use:draw={bubble}
        class="pixels"
        style:width="{bubble.cssWidth}px"
        style:height="{bubble.cssHeight}px"
      ></canvas>
    </div>
  {/each}
</div>

<div class="sr-only" role="status" aria-live="polite">{liveText}</div>

<style>
  .bubbles {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .bubble {
    position: absolute;
  }

  .pixels {
    display: block;
    image-rendering: pixelated;
  }

  /* Visually hidden but announced: a live region must not be display:none. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
