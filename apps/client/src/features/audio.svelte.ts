import type { EnvironmentId, WelcomeMessage } from "@dormouse/protocol";
import { loadPack } from "../room/packs/loader";
import type { RoomState } from "../state/room.svelte";
import { RoomAudioEngine } from "./audio/engine";
import { registerEnvironmentRequests } from "./audio/environment-events";
import type { SleepTimerMinutes } from "./audio/sleep-timer";
import { type AudioSourceId, resolveBedSources } from "./audio/sources";
import type { ClientFeature } from "./feature";

const VOLUME_STORAGE_KEY = "dormouse.audio.volumes.v1";
const DEFAULT_VOLUMES: Record<AudioSourceId, number> = { ambient: 0.7, tv: 0.7 };

function loadVolumes(): Record<AudioSourceId, number> {
  if (typeof localStorage === "undefined") return { ...DEFAULT_VOLUMES };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(VOLUME_STORAGE_KEY) ?? "null");
    if (typeof stored !== "object" || stored === null) return { ...DEFAULT_VOLUMES };
    const values = stored as Record<string, unknown>;
    return {
      ambient:
        typeof values.ambient === "number"
          ? Math.max(0, Math.min(1, values.ambient))
          : DEFAULT_VOLUMES.ambient,
      tv: typeof values.tv === "number" ? Math.max(0, Math.min(1, values.tv)) : DEFAULT_VOLUMES.tv,
    };
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

/** Room environment state plus the local, never-synced audio mix. */
export class AudioFeature {
  environment = $state<EnvironmentId>("rain");
  previewing = $state<EnvironmentId | null>(null);
  playing = $state<EnvironmentId | null>(null);
  cooldownUntil = $state(0);
  private clock = $state(Date.now());
  cooldownSeconds = $derived(Math.max(0, Math.ceil((this.cooldownUntil - this.clock) / 1000)));
  coolingDown = $derived(this.cooldownSeconds > 0);
  sleepMinutes = $state<SleepTimerMinutes>(0);
  volumes = $state<Record<AudioSourceId, number>>(loadVolumes());
  ready = $state(false);
  sleepExpired = $state(false);
  error = $state<string | null>(null);
  activeEnvironment = $derived(this.previewing ?? this.environment);

  private engine = new RoomAudioEngine();
  private pack: Awaited<ReturnType<typeof loadPack>> = null;
  private packPending = false;
  private packGeneration = 0;
  private playbackGeneration = 0;
  private unlocked = false;
  private unlocking: Promise<void> | null = null;
  private hasEnvironment = false;
  private registrationGeneration = 0;

  constructor() {
    this.engine.setVolume("ambient", this.volumes.ambient);
    this.engine.setVolume("tv", this.volumes.tv);
  }

  register: ClientFeature = (state, connection) => {
    this.hasEnvironment = false;
    ++this.registrationGeneration;
    const onFirstGesture = () => {
      void this.unlock().then(() => {
        if (!this.unlocked) return;
        window.removeEventListener("pointerdown", onFirstGesture);
        window.removeEventListener("keydown", onFirstGesture);
      });
    };
    window.addEventListener("pointerdown", onFirstGesture);
    window.addEventListener("keydown", onFirstGesture);
    const clock = setInterval(() => {
      this.clock = Date.now();
    }, 1000);

    const off = [
      registerEnvironmentRequests(state.events, () =>
        this.hasEnvironment ? this.environment : null,
      ),
      connection.on("welcome", (message) => {
        void this.onWelcome(state, message);
      }),
      connection.on("environmentChanged", ({ environment, cooldownUntil }) => {
        this.hasEnvironment = true;
        this.environment = environment;
        this.cooldownUntil = cooldownUntil;
        this.clock = Date.now();
        this.previewing = null;
        this.error = null;
        state.events.emit("environmentChanged", { id: environment });
        this.syncPlayback();
      }),
      connection.on("environmentChangeRejected", ({ reason, cooldownUntil }) => {
        this.cooldownUntil = cooldownUntil;
        this.clock = Date.now();
        this.previewing = null;
        this.error =
          reason === "cooldown"
            ? "The room just changed its sound. Try again after the cooldown."
            : "Wake up before changing the room's sound.";
        this.syncPlayback();
      }),
    ];

    return () => {
      ++this.registrationGeneration;
      clearInterval(clock);
      for (const remove of off) remove();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      ++this.packGeneration;
      ++this.playbackGeneration;
      this.packPending = false;
      this.engine.stop();
      this.playing = null;
    };
  };

  private async onWelcome(state: RoomState, message: WelcomeMessage): Promise<void> {
    this.hasEnvironment = true;
    this.environment = message.environment;
    this.cooldownUntil = message.environmentCooldownUntil;
    this.clock = Date.now();
    this.previewing = null;
    this.error = null;
    state.events.emit("environmentChanged", { id: message.environment });

    const generation = ++this.packGeneration;
    this.pack = null;
    this.packPending = Boolean(message.room.packId);
    if (message.room.packId) {
      const pack = await loadPack(message.room.packId);
      if (generation !== this.packGeneration) return;
      this.pack = pack;
      this.packPending = false;
    }
    this.syncPlayback();
  }

  /** Audition locally without changing shared state or spending the cooldown. */
  preview(environment: EnvironmentId): void {
    this.error = null;
    this.engine.clearSleepExpiration();
    this.sleepExpired = false;
    this.previewing = environment;
    this.syncPlayback();
    if (!this.unlocked) void this.unlock();
  }

  stopPreview(): void {
    this.previewing = null;
    this.syncPlayback();
  }

  applyEnvironment(state: RoomState): void {
    if (this.coolingDown) return;
    this.error = null;
    const wasDrifting = state.drifting;
    state.wake();
    // Background tabs can delay the local idle timer after the server dozes us.
    if (!wasDrifting) state.send({ t: "awake" });
    state.send({ t: "setEnvironment", environment: this.activeEnvironment });
  }

  setSleepTimer(minutes: SleepTimerMinutes): void {
    this.sleepMinutes = minutes;
    this.sleepExpired = false;
    this.engine.setSleepTimer(minutes, () => {
      this.sleepMinutes = 0;
      this.sleepExpired = true;
      this.playing = null;
    });
    this.syncPlayback();
  }

  setVolume(source: AudioSourceId, volume: number): void {
    const value = Math.max(0, Math.min(1, volume));
    this.volumes[source] = value;
    this.engine.setVolume(source, value);
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(this.volumes));
    } catch {
      // Private browsing/storage denial must not disable audio controls.
    }
  }

  /**
   * TV integration hook. Create media in `context`, then connect it to this gain;
   * `setVolume("tv", …)` and the persisted `volumes.tv` control that channel.
   */
  async sourceInput(source: AudioSourceId): Promise<GainNode> {
    return this.engine.sourceInput(source);
  }

  /** TV convenience hook: creates and routes a MediaElementAudioSourceNode. */
  async connectMediaElement(
    source: AudioSourceId,
    element: HTMLMediaElement,
  ): Promise<MediaElementAudioSourceNode> {
    return this.engine.connectMediaElement(source, element);
  }

  get context(): AudioContext | null {
    return this.engine.context;
  }

  private async unlock(): Promise<void> {
    if (this.unlocked) {
      this.syncPlayback();
      return;
    }
    if (this.unlocking) return this.unlocking;
    const registration = this.registrationGeneration;
    this.unlocking = (async () => {
      await this.engine.unlock();
      if (registration !== this.registrationGeneration) return;
      this.unlocked = true;
      this.ready = true;
      this.error = null;
      this.syncPlayback();
    })();
    try {
      await this.unlocking;
    } catch {
      this.error = "Sound could not start. Tap the room to try again.";
    } finally {
      this.unlocking = null;
    }
  }

  private syncPlayback(): void {
    if (this.packPending) return;
    const generation = ++this.playbackGeneration;
    const environment = this.activeEnvironment;
    const sources = resolveBedSources(this.pack, environment);
    if (!this.unlocked) {
      void this.engine.preload(sources).catch(() => {
        if (generation === this.playbackGeneration) {
          this.error = "The ambient recording could not be downloaded.";
        }
      });
      return;
    }
    void this.engine
      .play(environment, sources)
      .then((started) => {
        if (started && generation === this.playbackGeneration) this.playing = environment;
      })
      .catch(() => {
        if (generation === this.playbackGeneration) {
          this.error = "The ambient recording could not be played.";
        }
      });
  }
}
