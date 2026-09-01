import { PIXELS } from '../types';
import type { Layer, PixelBytes } from '../types';
import { pack, unpack } from './pixels';

/**
 * Composite the given layers (ordered bottom -> top) honoring visibility and
 * per-layer opacity using source-over blending. Returns RGBA bytes
 * (length PIXELS * 4), suitable for ImageData / gifenc.
 */
export function composite(layers: Layer[], out?: PixelBytes): PixelBytes {
  const result = out ?? new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < PIXELS; i++) {
    let dr = 0;
    let dg = 0;
    let db = 0;
    let da = 0;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const px = layer.pixels[i];
      const srcAlphaRaw = (px >>> 24) & 0xff;
      if (srcAlphaRaw === 0) continue;
      const { r, g, b } = unpack(px);
      const sa = (srcAlphaRaw / 255) * (layer.opacity / 100);
      if (sa <= 0) continue;
      const inv = 1 - sa;
      const oa = sa + da * inv;
      dr = oa > 0 ? (r * sa + dr * da * inv) / oa : dr;
      dg = oa > 0 ? (g * sa + dg * da * inv) / oa : dg;
      db = oa > 0 ? (b * sa + db * da * inv) / oa : db;
      da = oa;
    }
    const o = i * 4;
    result[o] = Math.round(dr);
    result[o + 1] = Math.round(dg);
    result[o + 2] = Math.round(db);
    result[o + 3] = Math.round(da * 255);
  }
  return result;
}

/**
 * Sample the composite view: returns the packed color of the topmost visible,
 * non-transparent layer at `index` (0 if none). Honors opacity so the sampled
 * value reflects what the user sees.
 */
export function sampleTopmost(layers: Layer[], index: number): number {
  for (let l = layers.length - 1; l >= 0; l--) {
    const layer = layers[l];
    if (!layer.visible) continue;
    const px = layer.pixels[index];
    if ((px >>> 24) !== 0) {
      const { r, g, b } = unpack(px);
      const a = Math.round(((px >>> 24) & 0xff) * (layer.opacity / 100));
      return pack(r, g, b, a);
    }
  }
  return 0;
}
