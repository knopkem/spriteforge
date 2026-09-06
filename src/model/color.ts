// Color utilities: hex parsing/formatting and nearest-color math used by the
// import quantizer and the GIF encoder. Pure, no DOM.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#?([0-9a-fA-F]{6})$/;

/** Parses "#rrggbb" (with or without '#'); throws on malformed input. */
export function parseHex(hex: string): RGB {
  const m = HEX.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function hexToRgb(hex: string): number[] {
  const { r, g, b } = parseHex(hex);
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function isValidHex(hex: string): boolean {
  return HEX.test(hex.trim());
}

/** Squared RGB distance (monotonic; avoids a sqrt per comparison). */
export function colorDistanceSq(a: number[], b: number[]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/** Index of the palette entry nearest to `color` (a [r,g,b] triple). */
export function nearestPaletteIndex(palette: string[], color: number[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistanceSq(hexToRgb(palette[i]), color);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
