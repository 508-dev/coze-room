<script lang="ts">
import type { PrivateRoomCreated, PublicRoomSummary } from "@dormouse/protocol";
import { normalizePrivateCode } from "@dormouse/protocol";
import { onMount } from "svelte";
import { createPrivateRoom, listPublicRooms } from "../features/private-rooms";
import type { RoomState } from "../state/room.svelte";
import AttractBackdrop from "./AttractBackdrop.svelte";

const { state: roomState }: { state: RoomState } = $props();

let rooms = $state<PublicRoomSummary[]>([]);
let loading = $state(true);
let loadError = $state(false);
let creating = $state(false);
let createError = $state(false);
let created = $state<PrivateRoomCreated | null>(null);
let code = $state("");
let deepLink = $state(false);
let copyStatus = $state("");
const shareLink = $derived(
  created
    ? `${window.location.origin}${window.location.pathname}#code=${encodeURIComponent(created.code)}`
    : "",
);

async function loadRooms(): Promise<void> {
  loading = true;
  loadError = false;
  try {
    rooms = await listPublicRooms();
  } catch {
    loadError = true;
  } finally {
    loading = false;
  }
}

async function makePrivateRoom(): Promise<void> {
  creating = true;
  createError = false;
  copyStatus = "";
  try {
    created = await createPrivateRoom();
  } catch {
    createError = true;
  } finally {
    creating = false;
  }
}

function joinWithCode(event: SubmitEvent): void {
  event.preventDefault();
  const normalized = normalizePrivateCode(code);
  if (normalized) roomState.joinByCode(normalized);
}

async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    copyStatus = `${label} copied.`;
  } catch {
    copyStatus = "Select the text and copy it.";
  }
}

function clearCodeFragment(): void {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (!hash.has("code")) return;
  hash.delete("code");
  const remaining = hash.toString();
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${remaining ? `#${remaining}` : ""}`,
  );
}

function showHome(): void {
  roomState.resetToStart();
  deepLink = false;
  created = null;
  code = "";
  copyStatus = "";
  clearCodeFragment();
  void loadRooms();
}

function occupancy(room: PublicRoomSummary): string {
  if (room.occupants === 0) return "Quiet and empty, for now";
  return `${room.occupants} here${room.asleep > 0 ? `, ${room.asleep} asleep` : ""}`;
}

$effect(() => {
  if (roomState.connected && deepLink) {
    clearCodeFragment();
    deepLink = false;
  }
});

onMount(() => {
  void loadRooms();
  const deepCode = new URLSearchParams(window.location.hash.slice(1)).get("code");
  if (deepCode) {
    deepLink = true;
    roomState.joinByCode(deepCode);
  }
  return () => roomState.dispose();
});
</script>

{#if !roomState.connected}
  <section class="start-screen" aria-label="Welcome to Dormouse">
    {#if !roomState.roomFull}
      <div class="attract-clip">
        <AttractBackdrop />
      </div>
    {/if}
    <div class="panel">
      {#if roomState.roomClosed}
        <p class="eyebrow">Dormouse</p>
        <h1>That room has closed.</h1>
        <p class="intro">Its sleepers have gone, and the code is no longer in use.</p>
        <button class="primary" type="button" onclick={showHome}>Back to the start</button>
      {:else if roomState.roomFull}
        <p class="eyebrow">This room is full</p>
        <h1>No spare blankets just yet.</h1>
        <p class="intro">These people are still inside. Come back a little later.</p>
        <ul class="full-roster" aria-label="People in this room">
          {#each roomState.occupants as occupant (occupant.id)}
            <li>
              <span>{occupant.name}</span>
              <small>{occupant.asleep ? "asleep" : "awake"}</small>
            </li>
          {/each}
        </ul>
        <button class="primary" type="button" onclick={showHome}>Back to the start</button>
      {:else if deepLink}
        <p class="eyebrow">Dormouse</p>
        <h1>Finding your room…</h1>
        <p class="intro">The light is still on. We’re taking you there.</p>
      {:else if created}
        {@const privateRoom = created}
        <p class="eyebrow">Your private room</p>
        <h1>A little room of your own.</h1>
        <p class="intro">Share this code with anyone you’d like beside you tonight.</p>
        <button
          class="room-code"
          type="button"
          title="Copy room code"
          onclick={() => void copy(privateRoom.code, "Room code")}
        >{privateRoom.code}</button>
        <p class="hint">Tap the code to copy it</p>
        <label class="share-label" for="share-link">Or share a link</label>
        <div class="share-row">
          <input id="share-link" readonly value={shareLink} onclick={(event) => event.currentTarget.select()} />
          <button type="button" onclick={() => void copy(shareLink, "Share link")}>Copy link</button>
        </div>
        <p class="copy-status" aria-live="polite">{copyStatus}</p>
        <button class="primary" type="button" onclick={() => roomState.joinByCode(privateRoom.code)}>
          Enter your room
        </button>
        <button class="text-button" type="button" onclick={showHome}>Back</button>
      {:else}
        <p class="eyebrow">Dormouse</p>
        <h1>Come in. Get comfortable.</h1>
        <p class="intro">A quiet room to watch something, wind down, and fall asleep together.</p>

        <div class="public-rooms">
          {#if loading}
            <p class="hint">Checking who’s here…</p>
          {:else if loadError}
            <p class="hint">We couldn’t see the room just now.</p>
            <button class="text-button" type="button" onclick={() => void loadRooms()}>Try again</button>
          {:else}
            {#each rooms as room (room.id)}
              <button class="public-room" type="button" onclick={() => roomState.join(room.id)}>
                <span>
                  <strong>{room.name}</strong>
                  <small>{occupancy(room)}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            {/each}
          {/if}
        </div>

        <div class="private-actions">
          <button class="secondary" type="button" disabled={creating} onclick={() => void makePrivateRoom()}>
            {creating ? "Making a room…" : "Make a private room"}
          </button>
          {#if createError}
            <p class="error" role="alert">We couldn’t make a room. Give it another try shortly.</p>
          {/if}
        </div>

        <form class="join-form" onsubmit={joinWithCode}>
          <label for="room-code">Have a private room code?</label>
          <div class="join-row">
            <input
              id="room-code"
              bind:value={code}
              placeholder="word-word-word"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              required
            />
            <button type="submit">Join</button>
          </div>
        </form>
      {/if}
    </div>
  </section>
{/if}

<style>
  .start-screen {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    overflow: auto;
    padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));
  }

  .attract-clip {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .panel {
    position: relative;
    width: min(100%, 30rem);
    padding: clamp(1.5rem, 5vw, 2.5rem);
    border: 1px solid #cfc6e024;
    border-radius: 1.25rem;
    background: #171320e8;
    box-shadow: 0 1.5rem 5rem #0008;
    backdrop-filter: blur(18px);
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    color: #b8a6cb;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: #eee8f5;
    font-family: Georgia, serif;
    font-size: clamp(1.8rem, 7vw, 2.5rem);
    font-weight: 400;
    line-height: 1.12;
  }

  .intro {
    margin: 1rem 0 1.75rem;
    color: #aaa0bb;
  }

  .full-roster {
    display: grid;
    gap: 0.5rem;
    max-height: 14rem;
    margin: 0 0 1.5rem;
    padding: 0;
    overflow: auto;
    list-style: none;
  }

  .full-roster li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.85rem;
    border-radius: 0.5rem;
    background: #cfc6e008;
  }

  .full-roster small {
    color: var(--dim);
  }

  button,
  input {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .public-rooms {
    margin: 0 0 1rem;
  }

  .public-room {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 1rem 1.1rem;
    border: 1px solid #cfc6e02b;
    border-radius: 0.75rem;
    background: #cfc6e008;
    color: var(--ink);
    text-align: left;
  }

  .public-room:hover {
    border-color: #cfc6e066;
    background: #cfc6e012;
  }

  .public-room strong,
  .public-room small {
    display: block;
  }

  .public-room strong {
    color: #eee8f5;
    font-weight: 500;
  }

  .public-room small,
  .hint {
    margin-top: 0.2rem;
    color: var(--dim);
    font-size: 0.8125rem;
  }

  .private-actions {
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #cfc6e018;
  }

  .primary,
  .secondary,
  .join-row button,
  .share-row button {
    min-height: 2.75rem;
    padding: 0.7rem 1rem;
    border-radius: 0.65rem;
  }

  .primary,
  .secondary {
    width: 100%;
  }

  .primary {
    border: 1px solid #d9c8ef;
    background: #d9c8ef;
    color: #21182c;
  }

  .secondary,
  .join-row button,
  .share-row button {
    border: 1px solid #cfc6e036;
    background: transparent;
    color: #ddd3e9;
  }

  .join-form {
    margin-top: 1.25rem;
  }

  .join-form label,
  .share-label {
    display: block;
    margin-bottom: 0.45rem;
    color: #aaa0bb;
    font-size: 0.8125rem;
  }

  .join-row,
  .share-row {
    display: flex;
    gap: 0.5rem;
  }

  input {
    min-width: 0;
    flex: 1;
    padding: 0.7rem 0.85rem;
    border: 1px solid #cfc6e036;
    border-radius: 0.65rem;
    outline: none;
    background: #0d0b1466;
    color: #eee8f5;
  }

  input:focus {
    border-color: #b8a6cb;
  }

  .room-code {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.75rem 0.25rem;
    border: 0;
    background: transparent;
    color: #eee8f5;
    font-size: clamp(1.45rem, 6vw, 2.15rem);
    font-weight: 500;
    letter-spacing: 0.025em;
    overflow-wrap: anywhere;
  }

  .room-code + .hint {
    margin: 0 0 1.5rem;
    text-align: center;
  }

  .share-row {
    margin-bottom: 0.5rem;
  }

  .share-row input {
    font-size: 0.75rem;
  }

  .copy-status {
    min-height: 1.5rem;
    margin: 0 0 0.5rem;
    color: #aaa0bb;
    font-size: 0.8125rem;
  }

  .text-button {
    display: block;
    margin: 0.75rem auto 0;
    padding: 0.25rem;
    border: 0;
    background: transparent;
    color: #aaa0bb;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .error {
    margin: 0.6rem 0 0;
    color: #e2a9b1;
    font-size: 0.8125rem;
  }

  @media (max-width: 25rem) {
    .start-screen {
      padding: 1rem;
    }

    .panel {
      padding: 1.25rem;
    }

    .share-row {
      flex-direction: column;
    }
  }
</style>
