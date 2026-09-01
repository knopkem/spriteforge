import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { WIDTH, HEIGHT } from '../types';
import type { Frame } from '../types';
import { composite } from '../logic/compose';

/**
 * Encode the full animation as a GIF (one frame per document frame, 250ms each).
 * Returns the raw GIF bytes.
 */
export function buildGif(frames: Frame[], delayMs = 250): Uint8Array {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const rgba = composite(frame.layers);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, WIDTH, HEIGHT, { palette, delay: delayMs });
  }
  gif.finish();
  return gif.bytes();
}
