<script lang="ts">
import { onMount } from "svelte";
import { Scene } from "../room/scene";
import type { RoomState } from "../state/room.svelte";

const { state: roomState }: { state: RoomState } = $props();
let host: HTMLDivElement;
let scene = $state.raw<Scene | null>(null);

$effect(() => {
  if (scene && roomState.room) scene.drawRoom(roomState.room);
});
$effect(() => {
  if (scene && roomState.selfId) scene.syncOccupants(roomState.occupants, roomState.selfId);
});
$effect(() => {
  scene?.driftOff(roomState.drifting);
});

onMount(() => {
  let disposed = false;
  const instance = new Scene();
  void instance.init(host, roomState.events).then(() => {
    if (disposed) instance.destroy();
    else scene = instance;
  });
  return () => {
    disposed = true;
    scene?.destroy();
    scene = null;
  };
});
</script>

<div class="stage" bind:this={host}></div>

<style>
  .stage {
    position: absolute;
    inset: 0;
  }

  @media (max-width: 40rem) and (orientation: portrait) {
    .stage {
      top: env(safe-area-inset-top);
      bottom: auto;
      height: 56.25vw;
    }
  }
</style>
