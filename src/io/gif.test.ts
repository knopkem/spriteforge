import { describe, it, expect } from 'vitest';
import { encodeGif } from './gif';
import { blankRGBA } from '../model/composite';
import type { RGBA } from '../model/composite';

function solid(w: number, h: number, r: number, g: number, b: number, a = 255): RGBA {
  const o = blankRGBA(w, h);
  for (let p = 0; p < w * h; p++) {
    o.data[p * 4] = r;
    o.data[p * 4 + 1] = g;
    o.data[p * 4 + 2] = b;
    o.data[p * 4 + 3] = a;
  }
  return o;
}

const palette = ['#ff0000', '#00ff00', '#0000ff'];

describe('encodeGif', () => {
  it('produces a valid GIF byte stream', () => {
    const bytes = encodeGif(
      [
        { rgba: solid(4, 4, 255, 0, 0), duration: 4 },
        { rgba: solid(4, 4, 0, 255, 0), duration: 8 },
      ],
      { palette, fps: 8, loop: true }
    );
    expect(bytes).toBeInstanceOf(Uint8Array);
    const header = String.fromCharCode(...bytes.slice(0, 6));
    expect(header).toMatch(/^GIF8/);
    // Trailer byte.
    expect(bytes[bytes.length - 1]).toBe(0x3b);
  });

  it('is larger when durations/frames increase', () => {
    const a = encodeGif([{ rgba: solid(4, 4, 255, 0, 0), duration: 4 }], { palette, fps: 8, loop: true });
    const b = encodeGif(
      [
        { rgba: solid(4, 4, 255, 0, 0), duration: 4 },
        { rgba: solid(4, 4, 0, 255, 0), duration: 4 },
        { rgba: solid(4, 4, 0, 0, 255), duration: 4 },
      ],
      { palette, fps: 8, loop: true }
    );
    expect(b.length).toBeGreaterThan(a.length);
  });

  it('maps fully transparent pixels to the reserved index without throwing', () => {
    const bytes = encodeGif([{ rgba: solid(2, 2, 0, 0, 0, 0), duration: 1 }], { palette, fps: 8, loop: false });
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('rejects empty input', () => {
    expect(() => encodeGif([], { palette, fps: 8, loop: true })).toThrow();
  });
});
