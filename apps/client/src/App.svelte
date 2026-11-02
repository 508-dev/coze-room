<script lang="ts">
import AttractBackdrop from "./components/AttractBackdrop.svelte";
import BubbleOverlay from "./components/BubbleOverlay.svelte";
import RoomCanvas from "./components/RoomCanvas.svelte";
import RoomChrome from "./components/RoomChrome.svelte";
import StartScreen from "./components/StartScreen.svelte";
import { RoomState } from "./state/room.svelte";

const state = new RoomState();
const attractPreview =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("attract");
</script>

<svelte:window onpointerdown={() => state.wake()} onkeydown={() => state.wake()} />

{#if attractPreview}
  <main>
    <AttractBackdrop stylised={false} />
  </main>
{:else}
  <main class:drifting={state.drifting}>
    {#if state.room}
      <RoomCanvas {state} />
      <BubbleOverlay {state} />
      <RoomChrome {state} />
    {/if}
    <StartScreen {state} />
  </main>
{/if}

<style>
  main {
    position: relative;
    height: 100%;
    transition: filter 4s ease-out, opacity 4s ease-out;
  }

  /* Dim rather than blank. The room is still there, it is just late. */
  main.drifting {
    filter: brightness(0.25);
    opacity: 0.9;
  }
</style>
