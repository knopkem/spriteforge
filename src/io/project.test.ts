import { describe, it, expect } from 'vitest';
import { createInitialState } from '../model/types';
import { serializeProject, deserializeProject, PROJECT_FORMAT } from './project';

function richState() {
  const s = createInitialState();
  s.tool = 'rect';
  s.brushSize = 2;
  s.activeColor = 6;
  s.fps = 12;
  s.loop = false;
  s.onionSkin = true;
  s.onionOpacity = 55;
  s.layers[0].name = 'BG';
  s.layers[1].opacity = 42;
  s.layers[2].visible = false;
  s.frames[0].duration = 7;
  s.frames[0].cels[0][0] = 4;
  s.frames[0].cels[0][10] = 15;
  s.frames[0].cels[1][100] = 2;
  // second frame with distinct pixels + duration
  s.frames.push({
    duration: 3,
    cels: s.layers.map(() => new Array(s.width * s.height).fill(-1)),
  });
  s.frames[1].cels[3][5] = 9;
  return s;
}

describe('project serialization', () => {
  it('is lossless across a full round-trip', () => {
    const original = richState();
    const text = serializeProject(original);
    const restored = deserializeProject(text);
    expect(restored).toEqual(original);
  });

  it('tags the file with the format name and version', () => {
    const dto = JSON.parse(serializeProject(createInitialState()));
    expect(dto.format).toBe(PROJECT_FORMAT);
    expect(dto.version).toBe(1);
  });

  it('preserves palette, layer order, frame order and durations', () => {
    const original = richState();
    const r = deserializeProject(serializeProject(original));
    expect(r.palette).toEqual(original.palette);
    expect(r.layers.map((l) => l.name)).toEqual(original.layers.map((l) => l.name));
    expect(r.layers.map((l) => l.opacity)).toEqual(original.layers.map((l) => l.opacity));
    expect(r.frames.map((f) => f.duration)).toEqual([7, 3]);
    expect(r.frames[1].cels[3][5]).toBe(9);
  });

  it('preserves tool settings', () => {
    const r = deserializeProject(serializeProject(richState()));
    expect(r.tool).toBe('rect');
    expect(r.brushSize).toBe(2);
    expect(r.activeColor).toBe(6);
    expect(r.fps).toBe(12);
    expect(r.loop).toBe(false);
    expect(r.onionSkin).toBe(true);
    expect(r.onionOpacity).toBe(55);
  });

  it('rejects non-project and malformed input', () => {
    expect(() => deserializeProject('not json')).toThrow();
    expect(() => deserializeProject(JSON.stringify({ hello: 1 }))).toThrow(/spriteforge/i);
    expect(() =>
      deserializeProject(JSON.stringify({ format: 'spriteforge', version: 99, doc: {} }))
    ).toThrow(/version/i);
    expect(() =>
      deserializeProject(
        JSON.stringify({
          format: 'spriteforge',
          version: 1,
          doc: { width: 2, height: 2, palette: ['#000000'], layers: [], frames: [] },
        })
      )
    ).toThrow();
  });

  it('rejects cels that reference a missing palette index', () => {
    const bad = {
      format: PROJECT_FORMAT,
      version: 1,
      doc: {
        width: 2,
        height: 2,
        palette: ['#000000'],
        layers: [{ id: 'a', name: 'L', visible: true, opacity: 100 }],
        frames: [{ duration: 4, cels: [{ rle: '5:4' }] }], // index 5 not in palette
        activeFrame: 0,
        activeLayer: 0,
        fps: 8,
        loop: true,
        onionSkin: false,
        onionOpacity: 30,
        tool: 'pencil',
        brushSize: 1,
      },
    };
    expect(() => deserializeProject(JSON.stringify(bad))).toThrow(/palette/i);
  });
});
