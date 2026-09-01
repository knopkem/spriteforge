import { WIDTH, HEIGHT, PIXELS } from '../types';
import { isEmpty, sameColor } from './pixels';

/**
 * Flood-fill a region of matching color starting at (x, y).
 * Mutates and returns `pixels`. Matching treats every transparent pixel as the
 * same target so a transparent region can be filled.
 */
export function floodFill(
  pixels: Uint32Array,
  x: number,
  y: number,
  newColor: number,
  width = WIDTH,
  height = HEIGHT,
): Uint32Array {
  const start = y * width + x;
  const target = pixels[start];
  if (sameColor(target, newColor)) return pixels;

  const matches = (i: number) => {
    if (isEmpty(target)) return isEmpty(pixels[i]);
    return sameColor(pixels[i], target);
  };

  const stack: number[] = [start];
  while (stack.length) {
    const i = stack.pop() as number;
    if (i < 0 || i >= PIXELS || !matches(i)) continue;
    pixels[i] = newColor >>> 0;
    const px = i % width;
    const py = (i / width) | 0;
    if (px > 0) stack.push(i - 1);
    if (px < width - 1) stack.push(i + 1);
    if (py > 0) stack.push(i - width);
    if (py < height - 1) stack.push(i + width);
  }
  return pixels;
}
