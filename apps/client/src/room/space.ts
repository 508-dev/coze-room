export const PLACEHOLDER_SIZE: readonly [number, number] = [640, 360];

/** Integer upscaling only. Below 1x, centre-crop rather than blur pixel art. */
export function roomTransform(width: number, height: number, size: readonly [number, number]) {
  const scale = Math.max(1, Math.floor(Math.min(width / size[0], height / size[1])));
  return {
    scale,
    x: Math.floor((width - size[0] * scale) / 2),
    y: Math.floor((height - size[1] * scale) / 2),
  };
}
