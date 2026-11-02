export const PLACEHOLDER_SIZE: readonly [number, number] = [640, 360];

/** Integer upscaling; smaller viewports fit the whole room fractionally. */
export function roomTransform(width: number, height: number, size: readonly [number, number]) {
  const fit = Math.min(width / size[0], height / size[1]);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  return {
    scale,
    x: Math.floor((width - size[0] * scale) / 2),
    y: Math.floor((height - size[1] * scale) / 2),
  };
}
