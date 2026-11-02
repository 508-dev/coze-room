<script lang="ts">
import { PHRASE_CATEGORIES, PHRASES } from "@dormouse/protocol";
import { enCategoryLabels, enPhrases } from "../features/phrases/locale/en";
import type { RoomState } from "../state/room.svelte";

const { state }: { state: RoomState } = $props();
</script>

<div class="phrases">
  <button
    class="toggle"
    aria-expanded={state.features.phrases.open}
    onclick={() => state.features.phrases.toggle()}
  >
    {#if state.features.phrases.open}
      close
    {:else}
      say…
    {/if}
  </button>

  {#if state.features.phrases.open}
    <div class="palette">
      {#each PHRASE_CATEGORIES as category}
        <div class="group">
          <h2>{enCategoryLabels[category]}</h2>
          <div class="chips">
            {#each PHRASES.filter((p) => p.category === category) as phrase (phrase.id)}
              <button
                class="chip"
                onclick={() => {
                  state.features.phrases.open = false;
                  state.features.phrases.say(phrase.id);
                }}
              >
                {enPhrases[phrase.id]}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .phrases {
    /* The chrome overlay ignores pointers; the palette is deliberately interactive. */
    pointer-events: auto;
    margin-top: 0.75rem;
    max-width: 22rem;
  }

  .toggle {
    font: inherit;
    color: var(--ink);
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    border: 1px solid var(--dim);
    border-radius: 0.5rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
  }

  .palette {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    border: 1px solid var(--dim);
    border-radius: 0.5rem;
  }

  h2 {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
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
    cursor: pointer;
  }

  .chip:hover,
  .chip:focus-visible,
  .toggle:hover,
  .toggle:focus-visible {
    border-color: var(--ink);
  }
</style>
