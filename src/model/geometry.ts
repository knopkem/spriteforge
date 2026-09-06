// Pure geometry helpers for the drawing tools. All functions operate on
// integer grid coordinates and return arrays of [x, y] pairs; callers are
// responsible for clamping/validating against the canvas bounds.

export type Point = [number, number];

function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

/** Bresenham line from (x0,y0) to (x1,y1), inclusive of both endpoints. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  // Guard against pathological loops; the loop is bounded by the box size.
  for (;;) {
    pts.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return pts;
}

/** Rectangle outline between two opposite corners (filled when fill=true). */
export function rectPoints(x0: number, y0: number, x1: number, y1: number, fill = false): Point[] {
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);
  const pts: Point[] = [];
  for (let x = xa; x <= xb; x++) {
    pts.push([x, ya]);
    if (yb !== ya) pts.push([x, yb]);
  }
  for (let y = ya + 1; y < yb; y++) {
    pts.push([xa, y]);
    if (xb !== xa) pts.push([xb, y]);
  }
  if (fill) {
    const out: Point[] = [];
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) out.push([x, y]);
    return out;
  }
  return pts;
}

/**
 * Ellipse outline inscribed in the bounding box defined by two opposite
 * corners, using the midpoint ellipse algorithm (mirrored into 4 quadrants).
 */
export function ellipsePoints(x0: number, y0: number, x1: number, y1: number, fill = false): Point[] {
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);
  const w = xb - xa + 1;
  const h = yb - ya + 1;
  const cx = xa + (w - 1) / 2;
  const cy = ya + (h - 1) / 2;
  const rx = (w - 1) / 2;
  const ry = (h - 1) / 2;
  const pts: Point[] = [];
  const seen = new Set<number>();
  const push = (x: number, y: number) => {
    const rx0 = Math.round(x);
    const ry0 = Math.round(y);
    const key = ry0 * 4096 + rx0;
    if (!seen.has(key)) {
      seen.add(key);
      pts.push([rx0, ry0]);
    }
  };

  if (rx === 0 && ry === 0) return [[xa, ya]];

  // Sample by parameter to keep the outline connected for small radii.
  const steps = Math.max(8, Math.ceil(Math.PI * (rx + ry) * 2));
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
  }

  if (fill) {
    const out: Point[] = [];
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const nx = rx === 0 ? 0 : (x - cx) / rx;
        const ny = ry === 0 ? 0 : (y - cy) / ry;
        if (nx * nx + ny * ny <= 1.05) out.push([x, y]);
      }
    }
    return out;
  }
  return pts;
}

/**
 * 4-connected flood fill. Returns the set of coordinates that should change,
 * stopping at pixels whose value differs from the seed value. Operates purely
 * on a cel array; does not mutate it.
 */
export function floodFill(
  cel: number[],
  width: number,
  height: number,
  sx: number,
  sy: number,
  targetIndex: number,
  replacementIndex: number
): Point[] {
  if (!inBounds(width, height, sx, sy)) return [];
  const seed = sy * width + sx;
  if (cel[seed] === replacementIndex) return [];
  const result: Point[] = [];
  const stack: number[] = [seed];
  const visited = new Set<number>();
  while (stack.length) {
    const p = stack.pop()!;
    if (visited.has(p)) continue;
    visited.add(p);
    if (cel[p] !== targetIndex) continue;
    const x = p % width;
    const y = (p - x) / width;
    result.push([x, y]);
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  return result;
}

/** A rectangular brush footprint anchored at (x,y) for the given size. */
export function brushPoints(x: number, y: number, size: number, width: number, height: number): Point[] {
  const pts: Point[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (inBounds(width, height, px, py)) pts.push([px, py]);
    }
  }
  return pts;
}

/** Points along a straight segment using the brush (for drag drawing between events). */
export function brushStroke(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  width: number,
  height: number
): Point[] {
  const seen = new Set<number>();
  const out: Point[] = [];
  for (const [x, y] of linePoints(x0, y0, x1, y1)) {
    for (const [bx, by] of brushPoints(x, y, size, width, height)) {
      const key = by * width + bx;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([bx, by]);
      }
    }
  }
  return out;
}
