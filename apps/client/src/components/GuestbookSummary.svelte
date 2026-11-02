<script lang="ts">
import type { GuestbookEntry } from "@dormouse/protocol";
import { joinNames } from "../features/guestbook-logic";
import type { RoomState } from "../state/room.svelte";

const { state }: { state: RoomState } = $props();

const feature = $derived(state.features.guestbook);

function nightLabel(entry: GuestbookEntry): string {
  return entry.date === feature.lastNight ? "last night" : entry.date;
}
</script>

{#if feature.wakeNames.length > 0}
  {#key feature.wakeSequence}
    <p class="wake">you slept beside {joinNames(feature.wakeNames)}</p>
  {/key}
{/if}

{#if feature.open}
  <div class="panel">
    <header>
      <h2>guestbook</h2>
      <button type="button" onclick={() => (feature.open = false)} aria-label="close">×</button>
    </header>
    {#if feature.entries.length === 0}
      <p class="empty">no one has slept here yet</p>
    {:else}
      <ul>
        {#each feature.entries as entry (entry.date)}
          <li>
            <strong>{entry.sleepers}</strong> slept here
            <span class="meta">· {entry.sleeperHours}h · {nightLabel(entry)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .wake {
    margin: 0.5rem 0 0;
    color: var(--ink);
    font-size: 0.8125rem;
    animation: wake-fade 7s ease-out forwards;
  }

  .panel {
    pointer-events: auto;
    margin-top: 0.75rem;
    padding: 0.75rem;
    max-width: 16rem;
    border-radius: 0.5rem;
    background: rgb(13 11 20 / 0.82);
    border: 1px solid rgb(107 99 128 / 0.4);
    backdrop-filter: blur(4px);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  button {
    border: 0;
    background: none;
    color: var(--dim);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }

  ul {
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin: 0.25rem 0 0;
    color: var(--ink);
    font-size: 0.8125rem;
  }

  .meta {
    color: var(--dim);
  }

  .empty {
    margin: 0.5rem 0 0;
    color: var(--dim);
    font-size: 0.8125rem;
  }

  @keyframes wake-fade {
    0% {
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
