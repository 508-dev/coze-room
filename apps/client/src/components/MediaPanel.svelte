<script lang="ts">
import { attachPlayback, mediaUrl, playbackMode } from "../features/media-playback";
import type { RoomState } from "../state/room.svelte";

const { state: roomState }: { state: RoomState } = $props();
const media = $derived(roomState.features.media);
const mode = $derived(
  playbackMode(!!media.base && !!media.item, roomState.drifting, media.watchOpen),
);
const url = $derived(
  media.item && mode !== "off"
    ? mediaUrl(media.base, media.item.id, mode === "audio" ? "m4a" : "mp4")
    : null,
);
let blocked = $state(false);
let unavailable = $state(false);
let player = $state.raw<ReturnType<typeof attachPlayback> | null>(null);

function playback(element: HTMLMediaElement) {
  blocked = false;
  unavailable = false;
  const instance = attachPlayback(
    element,
    media.position,
    (value) => {
      blocked = value;
    },
    media.audioSettings,
    media.item?.silent,
  );
  player = instance;
  return {
    destroy() {
      instance.destroy();
      if (player === instance) player = null;
    },
  };
}

$effect(() => {
  // Resync on the media snapshot and on every clock sample, without reloading the rendition.
  media.current;
  media.offset;
  player?.sync();
});
</script>

<section class="media" aria-label="Room TV">
  {#if !media.base}
    <p class="quiet">The TV is resting tonight.</p>
  {:else if media.item}
    <button class="watch" onclick={() => { roomState.wake(); media.watchOpen = true; }}>
      Playing from the shelf: {media.item.title} · {media.item.silent ? "Silent" : "With sound"}
    </button>
    <details>
      <summary>On the shelf</summary>
      {#each [true, false] as silent}
        <h3>{silent ? "Silent" : "With sound"}</h3>
        <ul>
          {#each media.catalogue.filter((item) => item.silent === silent) as item (item.id)}
            <li>{item.title} ({item.year})</li>
          {/each}
        </ul>
      {/each}
      <p><a href="/third-party-notices.txt" target="_blank" rel="noreferrer">Decoder licences</a></p>
    </details>
  {/if}

  {#if media.watchOpen}
    <section class="watch-view" aria-label="Watch the room TV">
      <header>
        <h2>{media.item?.title ?? "Room TV"}</h2>
        <button onclick={() => { media.watchOpen = false; }}>Back to the room</button>
      </header>
      {#if !media.base}
        <p>The TV is resting tonight.</p>
      {:else if roomState.drifting}
        <p>Drifting off — audio only. Tap to wake.</p>
      {:else if !media.item}
        <p>Nothing on the shelf just now.</p>
      {/if}
      {#if media.item}
        <p class="quiet">{media.item.silent ? "Silent" : "With sound"} · {media.item.licence}</p>
        {#if media.item.attribution}<p class="credit">{media.item.attribution}</p>{/if}
      {/if}
    </section>
  {/if}

  {#key url}
    {#if url && mode === "video"}
      <!-- svelte-ignore a11y_media_has_caption (catalogue films have no caption rendition) -->
      <video class="film" src={url} controls playsinline preload="metadata"
        aria-label={media.item?.title} use:playback onerror={() => { unavailable = true; }}></video>
    {:else if url && mode === "audio"}
      <audio src={url} preload="metadata" use:playback onerror={() => { unavailable = true; }}></audio>
    {/if}
  {/key}
  {#if mode !== "off" && unavailable}<p class="notice">The TV is resting. Please try again later.</p>{/if}
  {#if mode !== "off" && blocked && !unavailable}
    <button class="notice" onclick={() => player?.start()}>Tap to {mode === "audio" ? "listen" : "play"}</button>
  {/if}
</section>

<style>
  .media { max-width: min(28rem, calc(100vw - 2rem)); font-size: 0.8125rem; }
  button, details { pointer-events: auto; }
  button { color: inherit; background: #24202e; border: 1px solid #51445f; border-radius: 0.4rem; padding: 0.5rem; font: inherit; cursor: pointer; }
  .quiet { color: var(--dim); }
  a { color: inherit; }
  details { margin-top: 0.4rem; max-height: 13rem; overflow: auto; background: #17131dde; padding: 0.4rem; border-radius: 0.4rem; }
  summary { cursor: pointer; }
  h3 { font-size: inherit; margin: 0.5rem 0; }
  ul { margin: 0; padding-left: 1rem; }
  .watch-view { position: fixed; inset: 10vh 5vw; padding: 1rem; background: #17131df5; border: 1px solid #51445f; border-radius: 0.5rem; pointer-events: auto; overflow: auto; }
  header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
  h2 { font-size: 1rem; font-weight: 500; }
  .credit { font-size: 0.75rem; overflow-wrap: anywhere; max-width: 50rem; }
  .film { position: fixed; left: 10vw; top: 37vh; width: 80vw; height: 42vh; object-fit: contain; background: #08070c; pointer-events: auto; }
  .notice { position: fixed; bottom: 4vh; left: 5vw; padding: 0.5rem; background: #24202e; pointer-events: auto; }
</style>
