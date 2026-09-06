import { describe, it, expect } from 'vitest';
import { linePoints, rectPoints, ellipsePoints, floodFill, brushPoints, brushStroke } from './geometry';

describe('linePoints (Bresenham)', () => {
  it('connects endpoints inclusive on a diagonal', () => {
    const pts = linePoints(0, 0, 3, 3);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([3, 3]);
    expect(pts).toHaveLength(4);
  });

  it('draws a horizontal run', () => {
    const pts = linePoints(1, 2, 5, 2);
    expect(pts).toEqual([
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
    ]);
  });

  it('handles reversed direction', () => {
    const pts = linePoints(5, 0, 2, 0);
    expect(pts.map((p) => p[0])).toEqual([5, 4, 3, 2]);
  });

  it('is a single point when start==end', () => {
    expect(linePoints(4, 4, 4, 4)).toEqual([[4, 4]]);
  });
});

describe('rectPoints', () => {
  it('traces the outline of a 3x3 box', () => {
    const pts = rectPoints(0, 0, 2, 2);
    // corners present
    expect(pts).toEqual(expect.arrayContaining([[0, 0], [2, 0], [0, 2], [2, 2]]));
    // interior not present
    expect(pts).not.toEqual(expect.arrayContaining([[1, 1]]));
  });

  it('fills when fill=true', () => {
    const pts = rectPoints(0, 0, 1, 1, true);
    expect(pts).toHaveLength(4);
  });

  it('normalizes reversed corners', () => {
    const a = rectPoints(3, 3, 0, 0).sort();
    const b = rectPoints(0, 0, 3, 3).sort();
    expect(a).toEqual(b);
  });
});

describe('ellipsePoints', () => {
  it('stays within the bounding box', () => {
    const pts = ellipsePoints(2, 2, 9, 5);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(9);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(5);
    }
  });

  it('hits the four extreme edge midpoints', () => {
    const pts = new Set(ellipsePoints(0, 0, 8, 4).map((p) => `${p[0]},${p[1]}`));
    // left/right mid, top/bottom mid
    expect(pts.has('0,2')).toBe(true);
    expect(pts.has('8,2')).toBe(true);
    expect(pts.has('4,0')).toBe(true);
    expect(pts.has('4,4')).toBe(true);
  });

  it('degenerates to one point', () => {
    expect(ellipsePoints(3, 3, 3, 3)).toEqual([[3, 3]]);
  });

  it('fill covers the center', () => {
    const pts = new Set(ellipsePoints(0, 0, 6, 6, true).map((p) => `${p[0]},${p[1]}`));
    expect(pts.has('3,3')).toBe(true);
    expect(pts.has('0,0')).toBe(false);
  });
});

describe('floodFill', () => {
  const w = 5;
  const h = 5;
  const cel = new Array(w * h).fill(-1);

  it('fills a connected transparent region', () => {
    const pts = floodFill(cel, w, h, 0, 0, -1, 3);
    expect(pts).toHaveLength(w * h);
    expect(pts).toEqual(expect.arrayContaining([[0, 0], [4, 4], [2, 2]]));
  });

  it('stops at pixels with a different value', () => {
    const wall = cel.slice();
    for (let y = 0; y < h; y++) wall[y * w + 2] = 5; // vertical wall at x=2
    const pts = floodFill(wall, w, h, 0, 0, -1, 1);
    expect(pts.every(([, y]) => y >= 0 && y < h)).toBe(true);
    // Nothing to the right of the wall should be included
    expect(pts.some((x) => x[0] === 3)).toBe(false);
  });

  it('is a no-op when the target equals the replacement', () => {
    const already = new Array(w * h).fill(2);
    expect(floodFill(already, w, h, 0, 0, 2, 2)).toEqual([]);
  });

  it('returns empty for an out-of-bounds seed', () => {
    expect(floodFill(cel, w, h, -1, 0, -1, 1)).toEqual([]);
  });
});

describe('brush', () => {
  it('1px brush is a single point', () => {
    expect(brushPoints(2, 2, 1, 10, 10)).toEqual([[2, 2]]);
  });

  it('2px brush is a 2x2 block', () => {
    expect(brushPoints(2, 2, 2, 10, 10)).toHaveLength(4);
  });

  it('clips to the canvas bounds', () => {
    expect(brushPoints(9, 9, 2, 10, 10)).toEqual([[9, 9]]);
  });

  it('stroke covers every pixel along the segment', () => {
    const pts = brushStroke(0, 0, 3, 0, 1, 10, 10);
    expect(pts).toEqual(expect.arrayContaining([[0, 0], [1, 0], [2, 0], [3, 0]]));
  });
});
