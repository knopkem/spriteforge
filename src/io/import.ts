// Import pipeline helpers: nearest-neighbor downscale of an oversized RGBA
// buffer to the canvas size, and quantization of an RGBA buffer to palette
// indices. Both are pure so the lossy parts of import are unit-tested; the UI
// only decodes the PNG (canvas) and hands us pixels.

import type { RGBA } from '../model/composite';
import { blankRGBA } from '../model/composite';
import { nearestPaletteIndex } from '../model/color';

/**
 * Nearest-neighbor resample to dstW×dstH. If the source is already exactly the
 * destination size it is returned unchanged (a copy). Larger sources are
 * downscaled; this is a pure pixel resample, alpha is preserved.
 */
export function resampleNearest(src: RGBA, dstW: number, dstH: number): RGBA {
  if (src.width === dstW && src.height === dstH) {
    return { width: dstW, height: dstH, data: src.data.slice() };
  }
  const out = blankRGBA(dstW, dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / dstW));
      const s = (sy * src.width + sx) * 4;
      const d = (y * dstW + x) * 4;
      out.data[d] = src.data[s];
      out.data[d + 1] = src.data[s + 1];
      out.data[d + 2] = src.data[s + 2];
      out.data[d + 3] = src.data[s + 3];
    }
  }
  return out;
}

/** Convert an RGBA buffer (already canvas-sized) into a palette-indexed cel. */
export function quantizeRgbaToCel(rgba: RGBA, palette: string[]): number[] {
  const n = rgba.width * rgba.height;
  const cel = new Array<number>(n);
  for (let p = 0; p < n; p++) {
    const a = rgba.data[p * 4 + 3];
    if (a < 8) {
      cel[p] = -1;
      continue;
    }
    cel[p] = nearestPaletteIndex(palette, [rgba.data[p * 4], rgba.data[p * 4 + 1], rgba.data[p * 4 + 2]]);
  }
  return cel;
}
