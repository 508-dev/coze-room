/** Stable across seats and snapshots. AvatarLook's layered options resume after v0.1. */
export function occupantHash(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function occupantLook(id: string, looks: readonly string[]): string | undefined {
  return looks[occupantHash(id) % looks.length];
}

export function motionPhase(now: number, id: string, period: number): number {
  return (((now / 1000 / period + occupantHash(id) / 4294967296) % 1) + 1) % 1;
}

/** Integer room pixels only; absolute time also works at the drift-off ticker's 5 fps. */
export function breathingOffset(now: number, id: string, asleep: boolean, reduced = false): number {
  if (reduced) return 0;
  const phase = motionPhase(now, id, asleep ? 4 : 2);
  return phase >= 0.35 && phase < 0.65 ? 1 : 0;
}

export function observeReducedMotion(onChange: (reduced: boolean) => void): () => void {
  const media = globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)");
  onChange(media?.matches ?? false);
  const change = () => onChange(media?.matches ?? false);
  media?.addEventListener("change", change);
  return () => media?.removeEventListener("change", change);
}
