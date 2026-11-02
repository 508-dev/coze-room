<script lang="ts">
import RoomCanvas from "./components/RoomCanvas.svelte";
import RoomChrome from "./components/RoomChrome.svelte";
import StartScreen from "./components/StartScreen.svelte";
import { RoomState } from "./state/room.svelte";

const state = new RoomState();
</script>

<svelte:window onpointerdown={() => state.wake()} onkeydown={() => state.wake()} />

<main class:drifting={state.drifting}>
  <RoomCanvas {state} />
  <StartScreen {state} />
  <RoomChrome {state} />
</main>

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
