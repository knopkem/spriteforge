import { describe, it, expect } from 'vitest';
import { createDocument } from '../src/state/document';
import { History, restore, snapshot } from '../src/state/history';
import { pack } from '../src/logic/pixels';

describe('history', () => {
  it('undo/redo restores pixel state', () => {
    const doc = createDocument();
    const history = new History();
    const px = pack(1, 2, 3, 255) >>> 0;
    doc.frames[0].layers[0].pixels[0] = px;
    history.push(snapshot(doc));
    expect(doc.frames[0].layers[0].pixels[0]).toBe(px);

    doc.frames[0].layers[0].pixels[0] = 0;
    const back = history.undo(doc);
    expect(back).not.toBeNull();
    restore(doc, back!);
    expect(doc.frames[0].layers[0].pixels[0]).toBe(px);

    const fwd = history.redo(doc);
    restore(doc, fwd!);
    expect(doc.frames[0].layers[0].pixels[0]).toBe(0);
  });

  it('push clears the redo stack', () => {
    const doc = createDocument();
    const h = new History();
    doc.frames[0].layers[0].pixels[5] = 123;
    h.push(snapshot(doc));
    h.undo(doc);
    expect(h.canRedo()).toBe(true);
    h.push(snapshot(doc));
    expect(h.canRedo()).toBe(false);
  });

  it('supports unlimited history depth', () => {
    const doc = createDocument();
    const h = new History();
    for (let i = 0; i < 500; i++) {
      doc.frames[0].layers[0].pixels[0] = i;
      h.push(snapshot(doc));
    }
    let count = 0;
    while (h.canUndo()) {
      const s = h.undo(doc);
      restore(doc, s!);
      count++;
    }
    expect(count).toBe(500);
  });
});
