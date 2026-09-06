// Animated GIF encoding. Because SpriteForge's model is already palette-based,
// we build the GIF palette straight from the document palette (opaque colors)
// plus one reserved transparent index, and map pixels with our own nearest-
// color lookup. This is faster and more faithful for flat pixel art than
// re-quantizing every frame, and gives clean 1-bit transparency.

import { GIFEncoder, type Palette } from 'gifenc';
import type { RGBA } from '../model/composite';
import { hexToRgb, nearestPaletteIndex } from '../model/color';

export interface GifFrameInput {
  rgba: RGBA;
  /** Hold duration in units of the playback rate. */
  duration: number;
}

export interface EncodeGifOptions {
  palette: string[]; // "#rrggbb" document palette
  fps: number;
  loop: boolean;
}

export function encodeGif(frames: GifFrameInput[], opts: EncodeGifOptions): Uint8Array {
  if (!frames.length) throw new Error('No frames to encode');
  if (!opts.palette.length) throw new Error('Empty palette');

  const { width, height } = frames[0].rgba;
  const palette: Palette = opts.palette.map(hexToRgb);
  const transparentIndex = palette.length;
  palette.push([0, 0, 0]); // reserved transparent entry

  const encoder = GIFEncoder();
  frames.forEach((frame, i) => {
    if (frame.rgba.width !== width || frame.rgba.height !== height) {
      throw new Error('All frames must share a size');
    }
    const index = new Uint8Array(width * height);
    const src = frame.rgba.data;
    for (let p = 0; p < width * height; p++) {
      const a = src[p * 4 + 3];
      if (a < 128) {
        index[p] = transparentIndex;
      } else {
        index[p] = nearestPaletteIndex(opts.palette, [src[p * 4], src[p * 4 + 1], src[p * 4 + 2]]);
      }
    }
    const delay = Math.max(2, Math.round((frame.duration / opts.fps) * 100));
    encoder.writeFrame(index, width, height, {
      palette,
      delay,
      transparent: true,
      transparentIndex,
      repeat: i === 0 ? (opts.loop ? 0 : 1) : undefined,
    });
  });
  encoder.finish();
  return encoder.bytes();
}
