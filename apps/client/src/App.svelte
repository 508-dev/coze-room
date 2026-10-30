<script lang="ts">
import type { GuestbookEntry, Occupant, RoomSpec, ServerMessage } from "@dormouse/protocol";
import { onMount } from "svelte";
import { Connection } from "./net/connection";
import { Scene } from "./room/scene";

/** Idle this long with no pointer or key input and the client drifts off. */
const DRIFT_AFTER_MS = 10 * 60 * 1000;

let host = $state<HTMLDivElement | null>(null);
let scene: Scene | null = null;
let connection: Connection | null = null;

let selfId = $state<string | null>(null);
let room = $state<RoomSpec | null>(null);
let occupants = $state<Occupant[]>([]);
let guestbook = $state<GuestbookEntry[]>([]);
let drifting = $state(false);
let connected = $state(false);

const asleepCount = $derived(occupants.filter((o) => o.asleep).length);

let idleTimer: ReturnType<typeof setTimeout> | undefined;

function wake() {
  if (drifting) {
    drifting = false;
    scene?.driftOff(false);
    connection?.send({ t: "awake" });
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    drifting = true;
    scene?.driftOff(true);
  }, DRIFT_AFTER_MS);
}

function apply(message: ServerMessage) {
  switch (message.t) {
    case "welcome":
      selfId = message.selfId;
      room = message.room;
      occupants = message.occupants;
      guestbook = message.guestbook;
      connected = true;
      scene?.drawRoom(message.room);
      break;
    case "joined":
      occupants = [...occupants.filter((o) => o.id !== message.occupant.id), message.occupant];
      break;
    case "left":
      occupants = occupants.filter((o) => o.id !== message.id);
      break;
    case "moved":
      occupants = occupants.map((o) =>
        o.id === message.id ? { ...o, seatId: message.seatId } : o,
      );
      break;
    case "dozed":
      occupants = occupants.map((o) =>
        o.id === message.id ? { ...o, asleep: message.asleep } : o,
      );
      break;
    case "full":
      // Deliberately not an error screen: show who is in there instead.
      occupants = message.occupants;
      connected = false;
      break;
  }
}

$effect(() => {
  if (selfId) scene?.syncOccupants(occupants, selfId);
});

onMount(() => {
  let disposed = false;

  (async () => {
    if (!host) return;
    const s = new Scene();
    await s.init(host, {
      onSeatClick(seatId) {
        wake();
        connection?.send({ t: "takeSeat", seatId });
      },
    });
    if (disposed) {
      s.destroy();
      return;
    }
    scene = s;
    if (room) s.drawRoom(room);

    const c = new Connection("the-back-room", {
      name: "guest",
      look: { tone: 0, head: 0, top: 0, accessory: 0 },
    });
    c.on(apply);
    c.connect();
    connection = c;
    wake();
  })();

  return () => {
    disposed = true;
    clearTimeout(idleTimer);
    connection?.dispose();
    scene?.destroy();
  };
});
</script>

<svelte:window onpointerdown={wake} onkeydown={wake} />

<main class:drifting>
  <div class="stage" bind:this={host}></div>

  <aside class="chrome">
    <h1>{room?.name ?? "…"}</h1>
    <p class="count">
      {occupants.length} here{#if asleepCount > 0}, {asleepCount} asleep{/if}
    </p>

    {#if guestbook.length > 0}
      <p class="guestbook">{guestbook[0]?.sleepers} people slept here last night.</p>
    {/if}

    {#if !connected}
      <p class="status">reconnecting…</p>
    {/if}

    {#if drifting}
      <p class="status">drifted off — tap to wake</p>
    {/if}
  </aside>
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

  .stage {
    position: absolute;
    inset: 0;
  }

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
  .guestbook,
  .status {
    margin: 0.25rem 0 0;
    color: var(--dim);
    font-size: 0.8125rem;
  }
</style>
