<script lang="ts">
import { onMount } from "svelte";
import { AttractPlayback } from "../attract/playback";

const { stylised = true }: { stylised?: boolean } = $props();
let host: HTMLDivElement;

onMount(() => {
  const playback = new AttractPlayback();
  void playback.init(host).catch((error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: A decorative renderer may fail without blocking room entry.
    console.error("Attract backdrop could not start", error);
  });
  return () => playback.destroy();
});
</script>

<div class="backdrop" class:stylised bind:this={host} aria-hidden="true"></div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* Pixi eventMode does not propagate to children; this CSS guard blocks all hit-testing. */
    pointer-events: none;
    background: var(--bg);
  }

  /* Cover the decorative viewport; the interactive room still fits without cropping. */
  .backdrop.stylised {
    inset: auto;
    top: 50%;
    left: 50%;
    width: max(100%, calc(100dvh * 16 / 9));
    height: max(100%, calc(100vw * 9 / 16));
    filter: blur(14px) brightness(0.45) saturate(0.75);
    transform: translate(-50%, -50%) scale(1.04);
  }
</style>
