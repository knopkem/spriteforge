import { describe, it, expect } from 'vitest';
import { PALETTES, getPreset, presetToPacked } from '../src/logic/palettes';
import { unpack } from '../src/logic/pixels';

const HEX = /^#[0-9a-f]{6}$/;

describe('palettes', () => {
  for (const name of ['warm', 'cool', 'grayscale'] as const) {
    it(`${name} preset has 16 valid hex colors`, () => {
      const colors = PALETTES[name];
      expect(colors).toHaveLength(16);
      for (const c of colors) expect(c).toMatch(HEX);
    });
  }

  it('getPreset returns a copy (not the shared array)', () => {
    const a = getPreset('warm');
    a[0] = '#000000';
    expect(PALETTES.warm[0]).not.toBe('#000000');
  });

  it('presetToPacked yields opaque pixels', () => {
    const packed = presetToPacked('cool');
    expect(packed).toHaveLength(16);
    for (const p of packed) expect(unpack(p).a).toBe(255);
  });
});
