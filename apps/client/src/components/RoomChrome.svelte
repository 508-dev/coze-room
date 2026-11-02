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
    position: absolute;
    top: max(1rem, env(safe-area-inset-top));
    left: max(1rem, env(safe-area-inset-left));
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
</style>
