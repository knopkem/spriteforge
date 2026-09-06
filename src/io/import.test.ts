import { describe, it, expect } from 'vitest';
import { resampleNearest, quantizeRgbaToCel } from './import';
import { blankRGBA } from '../model/composite';

describe('resampleNearest', () => {
  it('returns a copy at the same size', () => {
    const src = blankRGBA(4, 4);
    src.data[0] = 123;
    const out = resampleNearest(src, 4, 4);
    expect(out.data[0]).toBe(123);
    expect(out.data).not.toBe(src.data);
  });

  it('downscales by sampling the top-left of each destination cell', () => {
    const src = blankRGBA(4, 4);
    // Mark (2,2) red so that the (1,1) dst cell picks it up.
    const o = (2 * 4 + 2) * 4;
    src.data[o] = 255;
    src.data[o + 3] = 255;
    const out = resampleNearest(src, 2, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(out.data[(1 * 2 + 1) * 4]).toBe(255);
  });
});

describe('quantizeRgbaToCel', () => {
  it('maps colors to the nearest palette index and keeps transparency', () => {
    const rgba = blankRGBA(2, 1);
    rgba.data[0] = 240;
    rgba.data[1] = 10;
    rgba.data[2] = 10;
    rgba.data[3] = 255; // pixel0: near red
    rgba.data[4 + 3] = 0; // pixel1: transparent
    const cel = quantizeRgbaToCel(rgba, ['#000000', '#ff0000', '#00ff00']);
    expect(cel[0]).toBe(1);
    expect(cel[1]).toBe(-1);
  });
});
