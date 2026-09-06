import { describe, it, expect } from 'vitest';
import { rleEncode, rleDecode } from './rle';

describe('rle', () => {
  it('round-trips arbitrary arrays', () => {
    const samples: number[][] = [
      [],
      [-1],
      [-1, -1, -1, 0, 1, 1, 2, 2, 2, 2, -1],
      new Array(1024).fill(-1),
      Array.from({ length: 100 }, (_, i) => i % 7),
    ];
    for (const s of samples) {
      expect(rleDecode(rleEncode(s), s.length)).toEqual(s);
    }
  });

  it('compresses long runs', () => {
    const s = new Array(1000).fill(5);
    const enc = rleEncode(s);
    expect(enc).toBe('5:1000');
    expect(enc.length).toBeLessThan(s.length);
  });

  it('throws on a length mismatch', () => {
    expect(() => rleDecode('1:3', 5)).toThrow(/mismatch/);
  });

  it('throws on malformed segments', () => {
    expect(() => rleDecode('a:b', 2)).toThrow();
    expect(() => rleDecode('1:0', 1)).toThrow();
  });
});
