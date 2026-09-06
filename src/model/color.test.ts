import { describe, it, expect } from 'vitest';
import { parseHex, rgbToHex, isValidHex, nearestPaletteIndex, hexToRgb } from './color';

describe('color utils', () => {
  it('parses #rrggbb with or without hash', () => {
    expect(parseHex('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseHex('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('throws on malformed hex', () => {
    expect(() => parseHex('#fff')).toThrow();
    expect(() => parseHex('red')).toThrow();
  });

  it('formats rgb back to lowercase hex, clamped', () => {
    expect(rgbToHex(255, 128, 0)).toBe('#ff8000');
    expect(rgbToHex(300, -5, 16)).toBe('#ff0010');
  });

  it('validates hex', () => {
    expect(isValidHex('#abcdef')).toBe(true);
    expect(isValidHex('#abc')).toBe(false);
  });

  it('finds the nearest palette color', () => {
    const pal = ['#000000', '#ff0000', '#00ff00'];
    expect(nearestPaletteIndex(pal, [250, 5, 5])).toBe(1);
    expect(nearestPaletteIndex(pal, [5, 245, 5])).toBe(2);
    expect(nearestPaletteIndex(pal, [3, 3, 3])).toBe(0);
  });

  it('hexToRgb returns a triple', () => {
    expect(hexToRgb('#102030')).toEqual([16, 32, 48]);
  });
});
