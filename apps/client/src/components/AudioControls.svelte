<script lang="ts">
import type { EnvironmentId } from "@dormouse/protocol";
import { SLEEP_TIMER_OPTIONS, type SleepTimerMinutes } from "../features/audio/sleep-timer";
import type { RoomState } from "../state/room.svelte";

const { state }: { state: RoomState } = $props();
const audio = $derived(state.features.audio);
const beds: { id: EnvironmentId; label: string }[] = [
  { id: "rain", label: "Rain" },
  { id: "clear-night", label: "Clear night" },
];
</script>

<section class="audio-controls" aria-label="Sound and sleep timer">
  <div class="environment" aria-label="Ambient environment">
    {#each beds as bed}
      <button
        type="button"
        class:active={audio.activeEnvironment === bed.id}
        aria-pressed={audio.activeEnvironment === bed.id}
        onclick={() => audio.preview(bed.id)}
      >
        {bed.label}
      </button>
    {/each}
  </div>
  <p class="hint">
    {#if audio.previewing}
      Local preview · room still has {audio.environment}
    {:else}
      Room sound · {audio.environment}
    {/if}
  </p>
  <div class="room-actions">
    <button
      type="button"
      disabled={audio.activeEnvironment === audio.environment}
      onclick={() => audio.applyEnvironment(state)}
    >
      Use for room
    </button>
    {#if audio.previewing}
      <button type="button" onclick={() => audio.stopPreview()}>Stop preview</button>
    {/if}
  </div>

  <label>
    Ambient volume
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={audio.volumes.ambient}
      oninput={(event) => audio.setVolume("ambient", event.currentTarget.valueAsNumber)}
    />
  </label>
  <label>
    TV volume
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={audio.volumes.tv}
      oninput={(event) => audio.setVolume("tv", event.currentTarget.valueAsNumber)}
    />
  </label>
  <label>
    Sleep timer
    <select
      value={audio.sleepMinutes}
      onchange={(event) =>
        audio.setSleepTimer(Number(event.currentTarget.value) as SleepTimerMinutes)}
    >
      {#each SLEEP_TIMER_OPTIONS as minutes}
        <option value={minutes}>{minutes === 0 ? "Off" : `${minutes} minutes`}</option>
      {/each}
    </select>
  </label>
  <p class="hint" role="status">
    {#if audio.error}
      {audio.error}
    {:else if audio.sleepExpired}
      Sleep timer finished · choose a sound to restart
    {:else if audio.ready}
      Sound on{minutesLabel(audio.sleepMinutes)}
    {:else}
      Sound starts on your first tap
    {/if}
  </p>
</section>

<script lang="ts" module>
function minutesLabel(minutes: SleepTimerMinutes): string {
  return minutes === 0 ? "" : ` · fades out in ${minutes} min`;
}
</script>

<style>
  .audio-controls {
    width: 11.5rem;
    margin-top: 0.75rem;
    pointer-events: auto;
    font-size: 0.75rem;
  }

  .environment,
  .room-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  button,
  select {
    border: 1px solid var(--dim);
    border-radius: 0.25rem;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
  }

  button {
    padding: 0.2rem 0.4rem;
    cursor: pointer;
  }

  button.active {
    background: var(--ink);
    color: var(--bg);
  }

  button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .hint {
    margin: 0.25rem 0;
    color: var(--dim);
  }

  label {
    display: block;
    margin-top: 0.35rem;
  }

  input[type="range"] {
    display: block;
    width: 100%;
  }

  select {
    margin-left: 0.25rem;
  }
</style>
