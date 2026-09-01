import { describe, it, expect } from 'vitest';
import { brushIndices, stamp } from '../src/logic/pencil';
import { WIDTH, HEIGHT } from '../src/types';
import { pack } from '../src/logic/pixels';

describe('pencil', () => {
  it('1px brush touches exactly one cell', () => {
    expect(brushIndices(4, 4, 1)).toEqual([4 * WIDTH + 4]);
  });

  it('2px brush stamps a 2x2 block with top-left anchor', () => {
    expect(brushIndices(4, 4, 2).sort((a, b) => a - b)).toEqual(
      [4 * WIDTH + 4, 4 * WIDTH + 5, 5 * WIDTH + 4, 5 * WIDTH + 5].sort((a, b) => a - b),
    );
  });

  it('clips indices that fall outside the grid', () => {
    const idx = brushIndices(WIDTH - 1, HEIGHT - 1, 2);
    expect(idx).toEqual([HEIGHT * WIDTH - 1]); // only the in-bounds cell
  });

  it('stamp writes color; 0 erases', () => {
    const g = new Uint32Array(WIDTH * HEIGHT);
    const red = pack(255, 0, 0, 255);
    stamp(g, 3, 3, 1, red);
    expect(g[3 * WIDTH + 3]).toBe(red);
    stamp(g, 3, 3, 1, 0);
    expect(g[3 * WIDTH + 3]).toBe(0);
  });
});
