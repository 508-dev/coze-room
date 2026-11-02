<script lang="ts">
import type { RoomState } from "../state/room.svelte";

const { state }: { state: RoomState } = $props();
</script>

{#if state.features.guestbook.entries.length > 0}
  <p>{state.features.guestbook.entries[0]?.sleepers} people slept here last night.</p>
{/if}

<style>
  p {
    margin: 0.25rem 0 0;
    color: var(--dim);
    font-size: 0.8125rem;
  }
</style>
