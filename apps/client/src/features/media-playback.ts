import type { MediaState } from "@dormouse/protocol";

export type PlaybackMode = "off" | "audio" | "video";

export interface PlaybackRouting {
  connect(element: HTMLMediaElement): Promise<MediaElementAudioSourceNode>;
  setVolume(volume: number): void;
}

export function playbackMode(
  available: boolean,
  drifting: boolean,
  watchOpen: boolean,
): PlaybackMode {
  if (!available) return "off";
  return drifting ? "audio" : watchOpen ? "video" : "off";
}

export function clockOffset(serverNow: number, receivedAt: number, sentAt = receivedAt): number {
  return serverNow - (sentAt + receivedAt) / 2;
}

export function seekSeconds(
  media: MediaState,
  duration: number,
  now: number,
  offset: number,
): number {
  if (!media.itemId || duration <= 0) return 0;
  return Math.max(
    0,
    Math.min((now + offset - media.startedAt) / 1000, Math.max(0, duration - 0.05)),
  );
}

/** Paths only ever point at our mirror, never a catalogue source URL. */
export function mediaUrl(
  base: string,
  id: string,
  rendition: "mp4" | "gif" | "m4a",
): string | null {
  if (!base.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
  return `${base.replace(/\/+$/, "")}/${id}.${rendition}`;
}

/** Owns exactly one rendition. Disposing aborts the old video before audio starts. */
export function attachPlayback(
  element: HTMLMediaElement,
  position: () => number,
  blocked: (value: boolean) => void,
  settings?: { muted: boolean },
  silent = false,
  routing?: PlaybackRouting,
) {
  let disposed = false;
  let routedNode: MediaElementAudioSourceNode | null = null;
  let routingPending = false;
  if (settings) element.muted = silent || settings.muted;
  if (routing) element.volume = 1;
  const route = () => {
    if (!routing || disposed || routedNode || routingPending) return;
    routingPending = true;
    void routing.connect(element).then(
      (node) => {
        routingPending = false;
        if (disposed) {
          node.disconnect();
          return;
        }
        routedNode = node;
      },
      () => {
        // Autoplay may require the explicit retry offered by start().
        routingPending = false;
      },
    );
  };
  const volumeChange = () => {
    if (routing && element.volume !== 1) {
      routing.setVolume(element.volume);
      // Web Audio owns audible gain; never multiply it by the native element.
      element.volume = 1;
    }
    if (settings && !silent) settings.muted = element.muted;
  };
  const sync = (force = false) => {
    if (element.readyState < 1) return;
    const target = position();
    if (force || Math.abs(element.currentTime - target) > 2) element.currentTime = target;
  };
  const start = () => {
    route();
    sync(true);
    void element.play().then(
      () => {
        if (!disposed) blocked(false);
      },
      () => {
        if (!disposed) blocked(true);
      },
    );
  };
  element.addEventListener("loadedmetadata", start);
  element.addEventListener("volumechange", volumeChange);
  const timer = setInterval(() => sync(), 15_000);
  route();
  if (element.readyState >= 1) start();
  return {
    sync,
    start,
    destroy() {
      disposed = true;
      routedNode?.disconnect();
      clearInterval(timer);
      element.removeEventListener("loadedmetadata", start);
      element.removeEventListener("volumechange", volumeChange);
      element.pause();
      element.removeAttribute("src");
      element.load();
    },
  };
}
