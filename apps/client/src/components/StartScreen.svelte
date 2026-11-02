<script lang="ts">
import { onMount } from "svelte";
import type { RoomState } from "../state/room.svelte";
import AttractBackdrop from "./AttractBackdrop.svelte";

const { state }: { state: RoomState } = $props();

// Placeholder: private-room controls and the attract-mode backdrop live here.
// Until then, preserve auto-joining the existing public room with no extra UI.
onMount(() => {
  state.join("the-back-room");
  return () => state.dispose();
});
</script>

{#if !state.connected}
  <AttractBackdrop />
{/if}
