import type { Rgba } from '../types';

// Packed pixel uses little-endian ImageData layout: 0xAABBGGRR.
export function pack(r: number, g: number, b: number, a: number): number {
  return (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0;
}

export function unpack(px: number): Rgba {
  return {
    r: px & 0xff,
    g: (px >>> 8) & 0xff,
    b: (px >>> 16) & 0xff,
    a: (px >>> 24) & 0xff,
  };
}

export function isEmpty(px: number): boolean {
  return (px >>> 24) === 0;
}

export function sameColor(a: number, b: number): boolean {
  return (a >>> 0) === (b >>> 0);
}

export function colorToHex(px: number): string {
  const { r, g, b } = unpack(px);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToRgba(hex: string): Rgba {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, a: 255 };
}

export function hexToPacked(hex: string): number {
  const { r, g, b } = hexToRgba(hex);
  return pack(r, g, b, 255);
}
