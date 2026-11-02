<script lang="ts">
import { onMount } from "svelte";
import { AttractPlayback } from "../attract/playback";

const { stylised = true }: { stylised?: boolean } = $props();
let host: HTMLDivElement;

onMount(() => {
  const playback = new AttractPlayback();
  void playback.init(host);
  return () => playback.destroy();
});
</script>

<div class="backdrop" class:stylised bind:this={host} aria-hidden="true"></div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    background: var(--bg);
  }

  /* The canvas renders at half resolution; CSS upscales and softens it further. */
  .backdrop.stylised {
    filter: blur(14px) brightness(0.45) saturate(0.75);
    transform: scale(1.04);
  }
</style>
