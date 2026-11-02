<script lang="ts">
import { PHRASE_CATEGORIES, PHRASES, type PhraseId } from "@dormouse/protocol";
import { enCategoryLabels, enPhrases } from "../features/phrases/locale/en";
import type { RoomState } from "../state/room.svelte";

const { state }: { state: RoomState } = $props();

let toggleEl: HTMLButtonElement | undefined;

function toggle(): void {
  state.features.phrases.toggle();
}

function close(): void {
  state.features.phrases.open = false;
  toggleEl?.focus();
}

function select(phraseId: PhraseId): void {
  state.features.phrases.say(phraseId);
  close();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && state.features.phrases.open) close();
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="phrases">
  <button
    class="toggle"
    aria-expanded={state.features.phrases.open}
    aria-controls="phrase-palette"
    bind:this={toggleEl}
    onclick={toggle}
  >
    {#if state.features.phrases.open}
      close
    {:else}
      say…
    {/if}
  </button>

  <div id="phrase-palette" class="palette" hidden={!state.features.phrases.open}>
    {#each PHRASE_CATEGORIES as category}
      <div class="group">
        <h2>{enCategoryLabels[category]}</h2>
        <div class="chips">
          {#each PHRASES.filter((p) => p.category === category) as phrase (phrase.id)}
            <button class="chip" onclick={() => select(phrase.id)}>
              {enPhrases[phrase.id]}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .phrases {
    /* The chrome overlay ignores pointers; the palette is deliberately interactive. */
    pointer-events: auto;
    margin-top: 0.75rem;
    max-width: min(22rem, calc(100vw - 2rem));
  }

  .toggle {
    font: inherit;
    color: var(--ink);
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    border: 1px solid var(--dim);
    border-radius: 0.5rem;
    padding: 0.4rem 0.75rem;
    min-height: 2.75rem;
    cursor: pointer;
  }

  .palette {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    border: 1px solid var(--dim);
    border-radius: 0.5rem;
    /* Fit a 360x640 viewport: scroll internally; the toggle stays reachable above. */
    max-height: min(60dvh, 24rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  h2 {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    /* #b6abce is ~8:1 on the palette background, well over the 4.5:1 bar. */
    color: #b6abce;
  }

  .group:first-child h2 {
    margin-top: 0;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .chip {
    font: inherit;
    color: var(--ink);
    background: color-mix(in srgb, var(--bg) 60%, transparent);
    border: 1px solid var(--dim);
    border-radius: 999px;
    padding: 0.35rem 0.6rem;
    min-height: 2.75rem;
    cursor: pointer;
  }

  .chip:hover,
  .chip:focus-visible,
  .toggle:hover,
  .toggle:focus-visible {
    border-color: var(--ink);
  }
</style>
