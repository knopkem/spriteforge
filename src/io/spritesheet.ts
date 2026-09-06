// Pure sprite-sheet assembly. Given composited frame buffers (RGBA8, all the
// same size), lay them out in a row-major grid with a uniform gutter and return
// a single RGBA8 sheet. The UI just blits the result to a canvas for download.

import type { RGBA } from '../model/composite';
import { blankRGBA } from '../model/composite';

export interface SpritesheetLayout {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  padding: number;
  width: number;
  height: number;
  /** Top-left pixel of each frame cell, in row-major order. */
  positions: { x: number; y: number }[];
}

/** Uniform gutter: padding is applied around the sheet and between every cell. */
export function computeSpritesheetLayout(
  frameCount: number,
  cellWidth: number,
  cellHeight: number,
  cols: number,
  padding: number
): SpritesheetLayout {
  const n = Math.max(1, frameCount);
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.ceil(n / c);
  const width = c * cellWidth + (c + 1) * padding;
  const height = rows * cellHeight + (rows + 1) * padding;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % c;
    const row = Math.floor(i / c);
    positions.push({
      x: padding + col * (cellWidth + padding),
      y: padding + row * (cellHeight + padding),
    });
  }
  return { cols: c, rows, cellWidth, cellHeight, padding, width, height, positions };
}

export function buildSpritesheet(frames: RGBA[], cols: number, padding: number): SpritesheetLayout & { data: Uint8ClampedArray } {
  if (!frames.length) throw new Error('No frames to lay out');
  const cellWidth = frames[0].width;
  const cellHeight = frames[0].height;
  const layout = computeSpritesheetLayout(frames.length, cellWidth, cellHeight, cols, padding);
  const out = blankRGBA(layout.width, layout.height);
  frames.forEach((frame, i) => {
    const { x, y } = layout.positions[i];
    for (let fy = 0; fy < cellHeight; fy++) {
      for (let fx = 0; fx < cellWidth; fx++) {
        const src = (fy * cellWidth + fx) * 4;
        const dst = ((y + fy) * layout.width + (x + fx)) * 4;
        out.data[dst] = frame.data[src];
        out.data[dst + 1] = frame.data[src + 1];
        out.data[dst + 2] = frame.data[src + 2];
        out.data[dst + 3] = frame.data[src + 3];
      }
    }
  });
  return { ...layout, data: out.data };
}
