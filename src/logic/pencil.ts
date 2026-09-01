import { WIDTH, HEIGHT } from '../types';

/**
 * Returns the pixel indices affected by a brush stamp of the given size at (x, y).
 * A 2px brush stamps a 2x2 block with (x, y) as the top-left cell. Indices that
 * fall outside the grid are clipped out.
 */
export function brushIndices(
  x: number,
  y: number,
  size: 1 | 2,
  width = WIDTH,
  height = HEIGHT,
): number[] {
  const out: number[] = [];
  const span = size;
  for (let dy = 0; dy < span; dy++) {
    for (let dx = 0; dx < span; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      out.push(py * width + px);
    }
  }
  return out;
}

/**
 * Stamps the whole stroke (a straight horizontal/vertical line of stamps) is not
 * handled here; this stamps a single brush mark. Returns changed indices.
 */
export function stamp(
  pixels: Uint32Array,
  x: number,
  y: number,
  size: 1 | 2,
  color: number,
  width = WIDTH,
  height = HEIGHT,
): number[] {
  const indices = brushIndices(x, y, size, width, height);
  const value = color >>> 0; // 0 => erase
  for (const i of indices) pixels[i] = value;
  return indices;
}
