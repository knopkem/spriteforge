import { describe, it, expect } from 'vitest';
import { composite, sampleTopmost } from '../src/logic/compose';
import { newLayer } from '../src/state/document';
import { pack } from '../src/logic/pixels';

function setPx(layer: ReturnType<typeof newLayer>, x: number, y: number, color: number) {
  layer.pixels[y * 32 + x] = color;
}

describe('composite', () => {
  it('renders an opaque single layer', () => {
    const l = newLayer('a', 'bg');
    setPx(l, 0, 0, pack(200, 100, 50, 255));
    const out = composite([l]);
    expect([out[0], out[1], out[2], out[3]]).toEqual([200, 100, 50, 255]);
  });

  it('blends two layers at 50% opacity of the top', () => {
    const bottom = newLayer('a', 'bg');
    setPx(bottom, 0, 0, pack(0, 0, 0, 255));
    const top = newLayer('b', 'fg', 50);
    setPx(top, 0, 0, pack(200, 100, 50, 255));
    const out = composite([bottom, top]);
    // src-over with sa = 0.5 over opaque black -> 0.5 * color
    expect(out[0]).toBe(100);
    expect(out[1]).toBe(50);
    expect(out[2]).toBe(25);
    expect(out[3]).toBe(255);
  });

  it('skips invisible layers', () => {
    const bottom = newLayer('a', 'bg');
    setPx(bottom, 0, 0, pack(0, 0, 0, 255));
    const hidden = newLayer('b', 'fg');
    hidden.visible = false;
    setPx(hidden, 0, 0, pack(255, 255, 255, 255));
    const out = composite([bottom, hidden]);
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 0]);
  });
});

describe('sampleTopmost', () => {
  it('returns the topmost visible non-transparent color', () => {
    const bottom = newLayer('a', 'bg');
    setPx(bottom, 1, 0, pack(10, 10, 10, 255));
    const top = newLayer('b', 'fg');
    setPx(top, 1, 0, pack(200, 200, 200, 255));
    const px = sampleTopmost([bottom, top], 1);
    expect(px >>> 0).toBe(pack(200, 200, 200, 255) >>> 0);
  });

  it('falls through transparent top pixels', () => {
    const bottom = newLayer('a', 'bg');
    setPx(bottom, 0, 0, pack(5, 6, 7, 255));
    const top = newLayer('b', 'fg'); // empty
    const px = sampleTopmost([bottom, top], 0);
    expect(px >>> 0).toBe(pack(5, 6, 7, 255) >>> 0);
  });

  it('ignores invisible layers', () => {
    const bottom = newLayer('a', 'bg');
    setPx(bottom, 0, 0, pack(9, 9, 9, 255));
    const hidden = newLayer('b', 'fg');
    hidden.visible = false;
    setPx(hidden, 0, 0, pack(99, 99, 99, 255));
    const px = sampleTopmost([bottom, hidden], 0);
    expect(px >>> 0).toBe(pack(9, 9, 9, 255) >>> 0);
  });

  it('returns 0 when nothing is present', () => {
    const l = newLayer('a', 'bg');
    expect(sampleTopmost([l], 0)).toBe(0);
  });
});
