import { describe, it, expect } from 'vitest';
import { onionComposite, blendRgba } from '../src/logic/onionSkin';
import { newLayer } from '../src/state/document';
import { pack } from '../src/logic/pixels';

function filledLayer(color: number): ReturnType<typeof newLayer> {
  const l = newLayer('l', 'l');
  l.pixels.fill(color);
  return l;
}

describe('onionSkin', () => {
  it('fades the previous frame to 30% where the current frame is empty', () => {
    const prev = [filledLayer(pack(100, 100, 100, 255))];
    const current = [newLayer('c', 'c')]; // empty
    const out = onionComposite(current, prev);
    // straight alpha: color preserved, fade carried in alpha (~0.3 * 255)
    expect([out[0], out[1], out[2]]).toEqual([100, 100, 100]);
    expect(out[3]).toBe(77); // round(0.3 * 255)
  });

  it('draws the current frame opaque on top of the ghost', () => {
    const prev = [filledLayer(pack(100, 100, 100, 255))];
    const current = [filledLayer(pack(0, 200, 0, 255))];
    const out = onionComposite(current, prev);
    expect([out[0], out[1], out[2]]).toEqual([0, 200, 0]);
  });

  it('blendRgba leaves dst untouched when src alpha is 0', () => {
    const dst = new Uint8ClampedArray([10, 20, 30, 255]);
    const src = new Uint8ClampedArray([255, 255, 255, 0]);
    blendRgba(dst, src, 1);
    expect(Array.from(dst)).toEqual([10, 20, 30, 255]);
  });
});
