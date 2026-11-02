import type { EnvironmentId } from "@dormouse/protocol";
import { SleepTimer, type SleepTimerMinutes } from "./sleep-timer";
import { type AudioSourceId, type BedSources, selectBedSource } from "./sources";

const AUDIO_CACHE = "dormouse-ambient-v1";
const CROSSFADE_SECONDS = 1.5;

interface PlayingBed {
  environment: EnvironmentId;
  url: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/** Web Audio graph: ambient/TV inputs -> local source gains -> timer -> output. */
export class RoomAudioEngine {
  private audioContext: AudioContext | null = null;
  private unlockPromise: Promise<void> | null = null;
  private sourceGains: Partial<Record<AudioSourceId, GainNode>> = {};
  private volumes: Record<AudioSourceId, number> = { ambient: 0.7, tv: 0.7 };
  private timerGain: GainNode | null = null;
  private sleepTimer: SleepTimer | null = null;
  private requestedSleepMinutes: SleepTimerMinutes = 0;
  private sleepFinished: (() => void) | undefined;
  private sleepExpired = false;
  private active: PlayingBed | null = null;
  private generation = 0;
  private downloads = new Map<string, Promise<ArrayBuffer>>();

  constructor(
    private readonly createContext: () => AudioContext = () => new AudioContext(),
    private readonly canPlayType: (mimeType: string) => string = (mimeType) =>
      document.createElement("audio").canPlayType(mimeType),
  ) {}

  get context(): AudioContext | null {
    return this.audioContext;
  }

  async unlock(): Promise<void> {
    if (this.audioContext?.state === "running") return;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = (async () => {
      if (!this.audioContext) this.createGraph();
      const context = this.audioContext;
      if (!context) throw new Error("audio graph was not created");
      if (context.state !== "running") await context.resume();
    })();
    try {
      await this.unlockPromise;
    } catch (error) {
      this.unlockPromise = null;
      throw error;
    }
  }

  private createGraph(): void {
    const context = this.createContext();
    this.audioContext = context;
    this.timerGain = context.createGain();
    this.timerGain.gain.value = 1;
    this.timerGain.connect(context.destination);
    for (const source of ["ambient", "tv"] as const) {
      const gain = context.createGain();
      gain.gain.value = this.volumes[source];
      gain.connect(this.timerGain);
      this.sourceGains[source] = gain;
    }
    this.sleepTimer = new SleepTimer(context, this.timerGain, () => {
      this.requestedSleepMinutes = 0;
      this.sleepExpired = true;
      // Keep the combined gain at zero: a connected TV must not become audible again.
      this.stop();
      this.sleepFinished?.();
    });
    this.sleepTimer.set(this.requestedSleepMinutes);
  }

  /** Preload into memory and Cache Storage without creating/resuming audio. */
  async preload(sources: BedSources): Promise<void> {
    await this.download(selectBedSource(sources, this.canPlayType));
  }

  /** Start a looping buffer and crossfade away from the previous environment. */
  async play(environment: EnvironmentId, sources: BedSources): Promise<boolean> {
    if (this.sleepExpired) return false;
    const generation = ++this.generation;
    await this.unlock();
    const context = this.audioContext;
    const ambient = this.sourceGains.ambient;
    if (!context || !ambient) throw new Error("audio is not ready");
    const url = selectBedSource(sources, this.canPlayType);
    if (this.active?.url === url) return true;

    const bytes = await this.download(url);
    const buffer = await context.decodeAudioData(bytes.slice(0));
    if (generation !== this.generation) return false;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(ambient);

    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    const previous = this.active;
    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
      previous.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
      previous.source.onended = () => {
        previous.source.disconnect();
        previous.gain.disconnect();
      };
      previous.source.stop(now + CROSSFADE_SECONDS + 0.05);
    }
    source.start(now);
    this.active = { environment, url, source, gain };
    return true;
  }

  stop(): void {
    ++this.generation;
    const active = this.active;
    this.active = null;
    if (!active) return;
    try {
      active.source.stop();
    } catch {
      // A source that already ended needs no further cleanup.
    }
    active.source.disconnect();
    active.gain.disconnect();
  }

  setVolume(source: AudioSourceId, volume: number): void {
    const value = Math.max(0, Math.min(1, volume));
    this.volumes[source] = value;
    const gain = this.sourceGains[source];
    const context = this.audioContext;
    if (gain && context) gain.gain.setTargetAtTime(value, context.currentTime, 0.02);
  }

  getVolume(source: AudioSourceId): number {
    return this.volumes[source];
  }

  setSleepTimer(minutes: SleepTimerMinutes, onFinished: () => void): void {
    this.requestedSleepMinutes = minutes;
    this.sleepFinished = onFinished;
    this.sleepExpired = false;
    this.sleepTimer?.set(minutes);
  }

  /** An explicit preview/timer action may restart audio after timer expiry. */
  clearSleepExpiration(): void {
    if (!this.sleepExpired) return;
    this.sleepExpired = false;
    this.sleepTimer?.set(0);
  }

  /** Generic TV hook: connect a node from this context to its persisted gain. */
  async sourceInput(source: AudioSourceId): Promise<GainNode> {
    await this.unlock();
    const input = this.sourceGains[source];
    if (!input) throw new Error("audio source is not ready");
    return input;
  }

  /** Convenience TV hook which creates and routes the media-element node. */
  async connectMediaElement(
    source: AudioSourceId,
    element: HTMLMediaElement,
  ): Promise<MediaElementAudioSourceNode> {
    await this.unlock();
    const context = this.audioContext;
    const input = this.sourceGains[source];
    if (!context || !input) throw new Error("audio source is not ready");
    const node = context.createMediaElementSource(element);
    node.connect(input);
    return node;
  }

  private download(url: string): Promise<ArrayBuffer> {
    const existing = this.downloads.get(url);
    if (existing) return existing;
    const pending = fetchCachedAudio(url);
    this.downloads.set(url, pending);
    void pending.catch(() => this.downloads.delete(url));
    return pending;
  }
}

/** Cache Storage persists across visits; ordinary HTTP caching is the fallback. */
export async function fetchCachedAudio(url: string): Promise<ArrayBuffer> {
  if (typeof caches === "undefined") {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio request failed: ${response.status}`);
    return response.arrayBuffer();
  }

  let cache: Cache | null = null;
  try {
    cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(url);
    if (cached) return cached.arrayBuffer();
  } catch {
    // Storage policy must not prevent the ordinary HTTP-cache fallback.
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`audio request failed: ${response.status}`);
  if (cache) {
    try {
      await cache.put(url, response.clone());
    } catch {
      // Quota/storage denial is non-fatal; the fetched audio is still usable.
    }
  }
  return response.arrayBuffer();
}
