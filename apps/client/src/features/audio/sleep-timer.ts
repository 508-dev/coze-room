export const SLEEP_TIMER_OPTIONS = [0, 15, 30, 60, 90] as const;
export type SleepTimerMinutes = (typeof SLEEP_TIMER_OPTIONS)[number];
export const WIND_DOWN_SECONDS = 60;

/** Schedules the ramp and its completion on the audio clock, not wall-clock timers. */
export class SleepTimer {
  private completion: OscillatorNode | null = null;

  constructor(
    private readonly context: Pick<AudioContext, "currentTime" | "createOscillator">,
    private readonly gain: GainNode,
    private readonly onFinished: () => void,
  ) {}

  set(minutes: SleepTimerMinutes): void {
    this.cancelCompletion();
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);

    if (minutes === 0) {
      this.gain.gain.setValueAtTime(1, now);
      return;
    }

    const end = now + minutes * 60;
    const rampStart = Math.max(now, end - WIND_DOWN_SECONDS);
    this.gain.gain.setValueAtTime(1, now);
    if (rampStart > now) this.gain.gain.setValueAtTime(1, rampStart);
    this.gain.gain.linearRampToValueAtTime(0, end);

    // An unconnected oscillator is a silent audio-clock alarm. Its scheduled stop
    // does not depend on setTimeout, which hidden tabs may throttle for minutes.
    const completion = this.context.createOscillator();
    this.completion = completion;
    completion.onended = () => {
      if (this.completion !== completion) return;
      this.completion = null;
      completion.disconnect();
      this.onFinished();
    };
    completion.start(now);
    completion.stop(end);
  }

  dispose(): void {
    this.cancelCompletion();
  }

  private cancelCompletion(): void {
    const completion = this.completion;
    if (!completion) return;
    this.completion = null;
    completion.onended = null;
    try {
      completion.stop();
    } catch {
      // A source that already ended needs no further cleanup.
    }
    completion.disconnect();
  }
}
