import { describe, it, expect } from 'vitest';
import { floodFill } from '../src/logic/floodFill';
import { pack, isEmpty } from '../src/logic/pixels';

function grid(): Uint32Array {
  return new Uint32Array(32 * 32);
}

describe('floodFill', () => {
  it('fills a connected region of the same color', () => {
    const g = grid();
    const red = pack(255, 0, 0, 255);
    const green = pack(0, 255, 0, 255);
    g[0] = red;
    g[1] = red;
    g[32] = red;
    g[33] = red;
    g[2] = green;
    floodFill(g, 0, 0, green);
    expect(g[0]).toBe(green);
    expect(g[1]).toBe(green);
    expect(g[32]).toBe(green);
    expect(g[33]).toBe(green);
  });

  it('does not cross a different-colored border', () => {
    const g = grid();
    const blue = pack(0, 0, 255, 255);
    // vertical wall at column 2
    for (let y = 0; y < 32; y++) g[y * 32 + 2] = pack(0, 0, 0, 255);
    floodFill(g, 0, 0, blue);
    // columns 0 and 1 filled, column 3 untouched
    expect(g[0 * 32 + 1]).toBe(blue);
    expect(isEmpty(g[0 * 32 + 3])).toBe(true);
  });

  it('fills a transparent region', () => {
    const g = grid();
    const amber = pack(255, 180, 0, 255);
    floodFill(g, 5, 5, amber);
    expect(g[5 * 32 + 5]).toBe(amber);
    expect(g[0]).toBe(amber); // whole canvas is transparent -> all connected
  });

  it('is a no-op when the target color equals the fill color', () => {
    const g = grid();
    const c = pack(10, 20, 30, 255);
    g[0] = c;
    floodFill(g, 0, 0, c);
    expect(g[0]).toBe(c);
    expect(g[1]).toBe(0);
  });
});
