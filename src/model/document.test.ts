import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from './document';

describe('Document', () => {
  let doc: Document;
  beforeEach(() => {
    doc = new Document();
  });

  it('starts with 4 layers and 1 frame', () => {
    const s = doc.getState();
    expect(s.layers).toHaveLength(4);
    expect(s.frames).toHaveLength(1);
    expect(s.palette.length).toBeGreaterThanOrEqual(16);
  });

  it('applyPoints writes palette index and -1 erases', () => {
    doc.pushHistory();
    doc.applyPoints([[0, 0], [1, 1]], 3);
    expect(doc.getActiveCel()[0]).toBe(3);
    expect(doc.getActiveCel()[1 * doc.width + 1]).toBe(3);
    doc.applyPoints([[0, 0]], -1);
    expect(doc.getActiveCel()[0]).toBe(-1);
  });

  it('undo reverts the last pushed mutation', () => {
    doc.pushHistory();
    doc.applyPoints([[0, 0]], 5);
    expect(doc.getActiveCel()[0]).toBe(5);
    doc.undo();
    expect(doc.getActiveCel()[0]).toBe(-1);
  });

  it('redo re-applies after undo', () => {
    doc.pushHistory();
    doc.applyPoints([[0, 0]], 5);
    doc.undo();
    doc.redo();
    expect(doc.getActiveCel()[0]).toBe(5);
  });

  it('reports undo/redo availability', () => {
    expect(doc.canUndo).toBe(false);
    doc.pushHistory();
    doc.applyPoints([[0, 0]], 1);
    expect(doc.canUndo).toBe(true);
    expect(doc.canRedo).toBe(false);
    doc.undo();
    expect(doc.canRedo).toBe(true);
  });

  it('undo reverts data but preserves ephemeral view fields', () => {
    doc.setTool('fill');
    doc.setActiveColor(3);
    doc.pushHistory();
    doc.applyPoints([[0, 0]], 5);
    doc.setActiveColor(7);
    doc.setTool('eraser');
    doc.undo();
    const s = doc.getState();
    expect(doc.getActiveCel()[0]).toBe(-1); // data reverted
    expect(s.tool).toBe('eraser'); // view preserved
    expect(s.activeColor).toBe(7);
  });

  it('addLayer inserts above the active layer with a cel on every frame', () => {
    doc.addFrame(); // now 2 frames
    doc.setActiveLayer(0);
    const before = doc.getState().layers.length;
    doc.addLayer();
    const s = doc.getState();
    expect(s.layers.length).toBe(before + 1);
    expect(s.activeLayer).toBe(1);
    for (const f of s.frames) {
      expect(f.cels.length).toBe(s.layers.length);
      expect(f.cels[1]).toHaveLength(doc.width * doc.height);
    }
  });

  it('deleteLayer keeps at least one layer and removes cels', () => {
    doc.setActiveLayer(1);
    doc.deleteLayer(1);
    expect(doc.getState().layers.length).toBe(3);
    expect(doc.getState().frames[0].cels.length).toBe(3);
  });

  it('moveLayer swaps both metadata and cels', () => {
    doc.getState().frames[0].cels[0][0] = 7;
    doc.pushHistory();
    doc.moveLayer(0, 1); // move bottom up
    expect(doc.getState().frames[0].cels[1][0]).toBe(7);
    expect(doc.getState().frames[0].cels[0][0]).toBe(-1);
  });

  it('reorderLayer reindexes the active layer', () => {
    doc.setActiveLayer(0);
    doc.reorderLayer(0, 3); // bottom -> top
    expect(doc.getState().activeLayer).toBe(3);
    doc.reorderLayer(3, 0);
    expect(doc.getState().activeLayer).toBe(0);
  });

  it('frame operations: add, duplicate, delete, reorder', () => {
    doc.getState().frames[0].cels[0][0] = 4;
    doc.duplicateFrame(0);
    expect(doc.getState().frames).toHaveLength(2);
    expect(doc.getState().activeFrame).toBe(1);
    expect(doc.getState().frames[1].cels[0][0]).toBe(4); // copied
    doc.getState().frames[1].cels[0][0] = 9;
    doc.reorderFrame(1, 0);
    expect(doc.getState().activeFrame).toBe(0); // active followed the frame
    expect(doc.getState().frames[0].cels[0][0]).toBe(9);
    doc.deleteFrame(1);
    expect(doc.getState().frames).toHaveLength(1);
  });

  it('clamps durations and refuses to delete the last frame', () => {
    doc.setFrameDuration(0, 999);
    expect(doc.getState().frames[0].duration).toBe(24);
    doc.setFrameDuration(0, 0);
    expect(doc.getState().frames[0].duration).toBe(1);
    doc.deleteFrame(0);
    expect(doc.getState().frames).toHaveLength(1);
  });

  it('addColor appends and selects; setPaletteColor edits in place', () => {
    const n = doc.getState().palette.length;
    const idx = doc.addColor('#123456');
    expect(idx).toBe(n);
    expect(doc.getState().activeColor).toBe(n);
    doc.setPaletteColor(idx, '#654321');
    expect(doc.getState().palette[idx]).toBe('#654321');
  });

  it('removeColor remaps cels: removed -> transparent, higher shift down', () => {
    const s = doc.getState();
    // palette[2] referenced by a cel pixel; palette[3] should shift to 2.
    s.frames[0].cels[0][0] = 3;
    doc.pushHistory();
    doc.removeColor(2);
    expect(doc.getActiveCel()[0]).toBe(2); // was 3, shifted down
    s.frames[0].cels[0][1] = 2;
    doc.pushHistory();
    doc.removeColor(2);
    expect(doc.getActiveCel()[1]).toBe(-1);
  });

  it('moveColor keeps activeColor pointing at the same swatch value', () => {
    doc.setActiveColor(1);
    const value = doc.getState().palette[1];
    doc.moveColor(1, 5);
    expect(doc.getState().palette[doc.getState().activeColor]).toBe(value);
  });

  it('fps clamps to the 1..24 range', () => {
    doc.setFps(100);
    expect(doc.getState().fps).toBe(24);
    doc.setFps(-5);
    expect(doc.getState().fps).toBe(1);
  });

  it('emits to subscribers on change', () => {
    let count = 0;
    const off = doc.subscribe(() => count++);
    doc.pushHistory();
    doc.applyPoints([[0, 0]], 1);
    expect(count).toBeGreaterThan(0);
    off();
    const before = count;
    doc.applyPoints([[1, 1]], 1);
    expect(count).toBe(before);
  });
});
