import type { Document } from '../types';
import { cloneLayers } from './document';

export function snapshot(doc: Document): Document {
  return {
    frames: doc.frames.map((f) => ({ layers: cloneLayers(f.layers) })),
  };
}

/** Copy `src` content into the live `target` document (in place). */
export function restore(target: Document, src: Document): void {
  target.frames.forEach((frame, fi) => {
    const srcFrame = src.frames[fi];
    frame.layers.forEach((layer, li) => {
      const s = srcFrame.layers[li];
      layer.name = s.name;
      layer.visible = s.visible;
      layer.opacity = s.opacity;
      layer.pixels.set(s.pixels);
    });
  });
}

/**
 * Unlimited undo/redo history storing deep snapshots of the document.
 */
export class History {
  private undoStack: Document[] = [];
  private redoStack: Document[] = [];

  /** Call with the document state BEFORE a mutation is applied. */
  push(doc: Document): void {
    this.undoStack.push(snapshot(doc));
    this.redoStack.length = 0;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(current: Document): Document | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(snapshot(current));
    return prev;
  }

  redo(current: Document): Document | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(snapshot(current));
    return next;
  }
}
