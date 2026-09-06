// Pure compositing: turns a DocState's frame into an RGBA8 buffer by
// source-over blending the visible layers (bottom to top) with per-layer alpha.

import type { DocState } from './types';
import { hexToRgb } from './color';

export interface RGBA {
  width: number;
  height: number;
  data: Uint8ClampedArray; // length width*height*4
}

export function blankRGBA(width: number, height: number): RGBA {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/**
 * Composite a single frame into RGBA. Layers are blended bottom-to-top; a
 * hidden layer contributes nothing and a layer's opacity acts as its pixel
 * alpha (drawn pixels are treated as opaque colors modulated by opacity).
 */
export function compositeFrame(doc: DocState, frameIndex: number): RGBA {
  const { width, height } = doc;
  const out = blankRGBA(width, height);
  const frame = doc.frames[frameIndex];
  if (!frame) return out;

  // Pre-decode palette to rgb triples once.
  const pal = doc.palette.map(hexToRgb);

  for (let li = 0; li < doc.layers.length; li++) {
    const layer = doc.layers[li];
    if (!layer.visible || layer.opacity <= 0) continue;
    const cel = frame.cels[li];
    if (!cel) continue;
    const srcA = layer.opacity / 100;
    for (let p = 0; p < width * height; p++) {
      const idx = cel[p];
      if (idx < 0) continue; // transparent
      const c = pal[idx];
      if (!c) continue;
      const o = p * 4;
      // Source is the palette color at alpha = srcA; destination is current.
      const dstA = out.data[o + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) continue;
      const inv = 1 - srcA;
      out.data[o + 0] = (c[0] * srcA + out.data[o + 0] * dstA * inv) / outA;
      out.data[o + 1] = (c[1] * srcA + out.data[o + 1] * dstA * inv) / outA;
      out.data[o + 2] = (c[2] * srcA + out.data[o + 2] * dstA * inv) / outA;
      out.data[o + 3] = outA * 255;
    }
  }
  return out;
}

/**
 * Composite every layer except the active one, for use as a preview base while
 * a shape tool is being dragged (the shape itself is drawn on top in the UI).
 */
export function compositeExceptLayer(doc: DocState, frameIndex: number, skipLayer: number): RGBA {
  const { width, height } = doc;
  const out = blankRGBA(width, height);
  const frame = doc.frames[frameIndex];
  if (!frame) return out;
  const pal = doc.palette.map(hexToRgb);
  for (let li = 0; li < doc.layers.length; li++) {
    if (li === skipLayer) continue;
    const layer = doc.layers[li];
    if (!layer.visible || layer.opacity <= 0) continue;
    const cel = frame.cels[li];
    if (!cel) continue;
    const srcA = layer.opacity / 100;
    for (let p = 0; p < width * height; p++) {
      const idx = cel[p];
      if (idx < 0) continue;
      const c = pal[idx];
      if (!c) continue;
      const o = p * 4;
      const dstA = out.data[o + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) continue;
      const inv = 1 - srcA;
      out.data[o + 0] = (c[0] * srcA + out.data[o + 0] * dstA * inv) / outA;
      out.data[o + 1] = (c[1] * srcA + out.data[o + 1] * dstA * inv) / outA;
      out.data[o + 2] = (c[2] * srcA + out.data[o + 2] * dstA * inv) / outA;
      out.data[o + 3] = outA * 255;
    }
  }
  return out;
}

/**
 * Composite a frame to a checkerboard background (for the editor canvas),
 * so transparent pixels read as "empty" rather than black.
 */
export function compositeOnChecker(doc: DocState, frameIndex: number): RGBA {
  const { width, height } = doc;
  const base = compositeFrame(doc, frameIndex);
  const out = blankRGBA(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const light = (x + y) % 2 === 0 ? 204 : 168;
      const a = base.data[p + 3] / 255;
      const inv = 1 - a;
      out.data[p + 0] = base.data[p + 0] * a + light * inv;
      out.data[p + 1] = base.data[p + 1] * a + light * inv;
      out.data[p + 2] = base.data[p + 2] * a + light * inv;
      out.data[p + 3] = 255;
    }
  }
  return out;
}
