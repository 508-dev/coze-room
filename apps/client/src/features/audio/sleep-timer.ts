export const SLEEP_TIMER_OPTIONS = [0, 15, 30, 60, 90] as const;
export type SleepTimerMinutes = (typeof SLEEP_TIMER_OPTIONS)[number];
export const WIND_DOWN_SECONDS = 60;

/** Schedules a gain ramp on the audio clock, independent of renderer drift-off. */
export class SleepTimer {
  private timeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly context: Pick<AudioContext, "currentTime">,
    private readonly gain: GainNode,
    private readonly onFinished: () => void,
  ) {}

  set(minutes: SleepTimerMinutes): void {
    clearTimeout(this.timeout);
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
    this.timeout = setTimeout(this.onFinished, minutes * 60 * 1000);
  }

  dispose(): void {
    clearTimeout(this.timeout);
  }
}
