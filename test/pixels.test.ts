import { describe, it, expect } from 'vitest';
import { pack, unpack, isEmpty, hexToPacked, colorToHex } from '../src/logic/pixels';

describe('pixels', () => {
  it('round-trips r,g,b,a through pack/unpack', () => {
    const px = pack(12, 34, 56, 200);
    expect(unpack(px)).toEqual({ r: 12, g: 34, b: 56, a: 200 });
  });

  it('packs in little-endian ImageData order (0xAABBGGRR)', () => {
    expect(pack(0x11, 0x22, 0x33, 0x44)).toBe(0x44332211);
  });

  it('treats alpha 0 as empty', () => {
    expect(isEmpty(pack(255, 0, 0, 0))).toBe(true);
    expect(isEmpty(pack(255, 0, 0, 255))).toBe(false);
    expect(isEmpty(0)).toBe(true);
  });

  it('converts hex to packed and back', () => {
    const px = hexToPacked('#89b4fa');
    expect(unpack(px)).toEqual({ r: 0x89, g: 0xb4, b: 0xfa, a: 255 });
    expect(colorToHex(px)).toBe('#89b4fa');
  });
});
