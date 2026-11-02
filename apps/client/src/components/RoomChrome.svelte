<script lang="ts">
import type { RoomState } from "../state/room.svelte";
import { featurePanels } from "./feature-panels";

const { state }: { state: RoomState } = $props();
</script>

<aside class="chrome">
  <h1>{state.room?.name ?? "…"}</h1>
  <p class="count">
    {state.occupants.length} here{#if state.asleepCount > 0}, {state.asleepCount} asleep{/if}
  </p>
  {#each featurePanels as Panel}
    <Panel {state} />
  {/each}
  {#if !state.connected}
    <p class="status">reconnecting…</p>
  {/if}
  {#if state.drifting}
    <p class="status">drifted off — tap to wake</p>
  {/if}
</aside>

<style>
  .chrome {
    --dim: #aaa0bb;
    position: absolute;
    top: max(1rem, env(safe-area-inset-top));
    left: max(1rem, env(safe-area-inset-left));
    width: max-content;
    max-width: calc(100vw - 2rem);
    padding: 0.75rem;
    border: 1px solid #cfc6e024;
    border-radius: 0.75rem;
    background: #0d0b14ed;
    box-shadow: 0 0.5rem 2rem #0004;
    pointer-events: none;
  }

  h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .count,
  .status {
    margin: 0.25rem 0 0;
    color: var(--dim);
    font-size: 0.8125rem;
  }

  @media (max-width: 40rem) and (orientation: portrait) {
    .chrome {
      top: calc(56.25vw + env(safe-area-inset-top));
      right: 0;
      bottom: 0;
      left: 0;
      width: auto;
      max-width: none;
      padding: 1rem max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom))
        max(1rem, env(safe-area-inset-left));
      border: 0;
      border-radius: 0;
      background: var(--bg);
      box-shadow: none;
      overflow-y: auto;
      overscroll-behavior: contain;
      pointer-events: auto;
    }
  }
</style>
