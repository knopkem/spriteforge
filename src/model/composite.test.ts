import { describe, it, expect } from 'vitest';
import { compositeFrame } from './composite';
import { createInitialState } from './types';
import type { DocState } from './types';

function base(): DocState {
  const s = createInitialState();
  // Two-layer setup, top layer opaque white, bottom opaque red.
  s.palette = ['#ff0000', '#ffffff'];
  s.layers = [
    { id: 'a', name: 'bottom', visible: true, opacity: 100 },
    { id: 'b', name: 'top', visible: true, opacity: 100 },
  ];
  const bottom = new Array(s.width * s.height).fill(-1);
  const top = new Array(s.width * s.height).fill(-1);
  return { ...s, frames: [{ duration: 1, cels: [bottom, top] }], activeFrame: 0, activeLayer: 0 };
}

describe('compositeFrame', () => {
  it('is transparent when no pixels are set', () => {
    const out = compositeFrame(base(), 0);
    expect(out.data[3]).toBe(0);
  });

  it('paints an opaque bottom pixel exactly', () => {
    const s = base();
    s.frames[0].cels[0][0] = 0; // red on bottom
    const out = compositeFrame(s, 0);
    expect(out.data[0]).toBe(255);
    expect(out.data[1]).toBe(0);
    expect(out.data[3]).toBe(255);
  });

  it('top layer wins where both are opaque', () => {
    const s = base();
    s.frames[0].cels[0][0] = 0;
    s.frames[0].cels[1][0] = 1;
    const out = compositeFrame(s, 0);
    expect(out.data[0]).toBe(255);
    expect(out.data[1]).toBe(255); // white
  });

  it('blends a 50% top layer over an opaque bottom', () => {
    const s = base();
    s.frames[0].cels[0][0] = 0; // red, opaque
    s.frames[0].cels[1][0] = 1; // white on top
    s.layers[1].opacity = 50;
    const out = compositeFrame(s, 0);
    // 0.5 white over red => green 127.5, stored rounded to 128
    expect(out.data[0]).toBe(255);
    expect(out.data[1]).toBe(128);
    expect(out.data[3]).toBe(255);
  });

  it('semi-transparent single layer yields alpha', () => {
    const s = base();
    s.frames[0].cels[0][0] = 0;
    s.layers[0].opacity = 50;
    const out = compositeFrame(s, 0);
    expect(out.data[3]).toBe(128); // 0.5*255 rounds to 128 in Uint8ClampedArray
    expect(out.data[0]).toBe(255);
  });

  it('ignores hidden layers', () => {
    const s = base();
    s.frames[0].cels[0][0] = 0;
    s.layers[0].visible = false;
    const out = compositeFrame(s, 0);
    expect(out.data[3]).toBe(0);
  });

  it('respects layer order (index 0 bottom)', () => {
    const s = base();
    // Put white only on bottom and red only on top: top should win.
    s.frames[0].cels[0][0] = 1; // bottom white
    s.frames[0].cels[1][0] = 0; // top red
    const out = compositeFrame(s, 0);
    expect(out.data[0]).toBe(255);
    expect(out.data[1]).toBe(0);
  });
});
