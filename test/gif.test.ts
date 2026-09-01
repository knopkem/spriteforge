import { describe, it, expect } from 'vitest';
import { buildGif } from '../src/export/gif';
import { createDocument } from '../src/state/document';
import { pack } from '../src/logic/pixels';

describe('gif export', () => {
  it('encodes 4 frames into a non-empty GIF8 byte stream', () => {
    const doc = createDocument(4);
    for (let f = 0; f < 4; f++) {
      doc.frames[f].layers[0].pixels.fill(pack(f * 60, 30, 200, 255) >>> 0);
    }
    const bytes = buildGif(doc.frames);
    expect(bytes.length).toBeGreaterThan(0);
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    expect(header).toBe('GIF89a');
  });
});
