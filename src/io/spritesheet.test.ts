import { describe, it, expect } from 'vitest';
import { computeSpritesheetLayout, buildSpritesheet } from './spritesheet';
import { blankRGBA } from '../model/composite';
import type { RGBA } from '../model/composite';

function solid(w: number, h: number, r: number, g: number, b: number): RGBA {
  const o = blankRGBA(w, h);
  for (let p = 0; p < w * h; p++) {
    o.data[p * 4] = r;
    o.data[p * 4 + 1] = g;
    o.data[p * 4 + 2] = b;
    o.data[p * 4 + 3] = 255;
  }
  return o;
}

describe('spritesheet layout', () => {
  it('computes a uniform-gutter grid', () => {
    const l = computeSpritesheetLayout(4, 32, 32, 2, 1);
    expect(l.cols).toBe(2);
    expect(l.rows).toBe(2);
    expect(l.width).toBe(2 * 32 + 3 * 1);
    expect(l.height).toBe(2 * 32 + 3 * 1);
    expect(l.positions[0]).toEqual({ x: 1, y: 1 });
    expect(l.positions[1]).toEqual({ x: 34, y: 1 });
    expect(l.positions[2]).toEqual({ x: 1, y: 34 });
  });

  it('single row when cols == frameCount and zero padding', () => {
    const l = computeSpritesheetLayout(3, 32, 32, 3, 0);
    expect(l.width).toBe(96);
    expect(l.height).toBe(32);
    expect(l.positions[2]).toEqual({ x: 64, y: 0 });
  });
});

describe('buildSpritesheet', () => {
  it('blits frames into their cells and leaves padding transparent', () => {
    const frames = [solid(2, 2, 255, 0, 0), solid(2, 2, 0, 255, 0), solid(2, 2, 0, 0, 255)];
    const sheet = buildSpritesheet(frames, 3, 1);
    // cols=3, rows=1 -> width 3*2+4*1=10, height 1*2+2*1=4
    expect(sheet.width).toBe(10);
    expect(sheet.height).toBe(4);
    const at = (x: number, y: number) => {
      const o = (y * sheet.width + x) * 4;
      return [sheet.data[o], sheet.data[o + 1], sheet.data[o + 2], sheet.data[o + 3]];
    };
    expect(at(1, 1)).toEqual([255, 0, 0, 255]); // frame0
    expect(at(4, 1)).toEqual([0, 255, 0, 255]); // frame1 (x=4)
    expect(at(7, 1)).toEqual([0, 0, 255, 255]); // frame2 (x=7)
    expect(at(0, 0)[3]).toBe(0); // padding transparent
  });
});
