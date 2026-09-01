import { PIXELS } from '../types';
import type { Layer } from '../types';
import { composite } from './compose';

/**
 * Blend `srcRgba` over `dstRgba` in place (both RGBA byte arrays, length
 * PIXELS * 4). `alphaFactor` scales the source alpha (e.g. 0.3 for onion skin).
 */
export function blendRgba(
  dstRgba: Uint8ClampedArray,
  srcRgba: Uint8ClampedArray,
  alphaFactor = 1,
): Uint8ClampedArray {
  for (let i = 0; i < PIXELS * 4; i += 4) {
    const sa = (srcRgba[i + 3] / 255) * alphaFactor;
    if (sa <= 0) continue;
    const da = dstRgba[i + 3] / 255;
    const inv = 1 - sa;
    const oa = sa + da * inv;
    dstRgba[i] = oa > 0 ? Math.round((srcRgba[i] * sa + dstRgba[i] * da * inv) / oa) : dstRgba[i];
    dstRgba[i + 1] =
      oa > 0 ? Math.round((srcRgba[i + 1] * sa + dstRgba[i + 1] * da * inv) / oa) : dstRgba[i + 1];
    dstRgba[i + 2] =
      oa > 0 ? Math.round((srcRgba[i + 2] * sa + dstRgba[i + 2] * da * inv) / oa) : dstRgba[i + 2];
    dstRgba[i + 3] = Math.round(oa * 255);
  }
  return dstRgba;
}

/**
 * Build an onion-skin view: the previous frame rendered as a 30%-opacity ghost
 * with the current frame composited on top.
 */
export function onionComposite(
  currentLayers: Layer[],
  previousLayers: Layer[],
  ghostAlpha = 0.3,
): Uint8ClampedArray {
  const base = new Uint8ClampedArray(PIXELS * 4);
  blendRgba(base, composite(previousLayers), ghostAlpha);
  blendRgba(base, composite(currentLayers), 1);
  return base;
}
