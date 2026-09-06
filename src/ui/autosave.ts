// Autosave to localStorage: throttled snapshot of the serialized project, plus
// restore/clear. The "New" action clears it so a fresh session doesn't resurrect.

import type { Document } from '../model/document';
import { serializeProject, deserializeProject } from '../io/project';

const KEY = 'spriteforge.autosave';
const THROTTLE_MS = 5000;

export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;
  private dirty = false;

  constructor(private doc: Document) {}

  /** Mark state dirty; writes at most once per THROTTLE_MS. */
  scheduleSave(): void {
    this.dirty = true;
    const wait = Math.max(0, THROTTLE_MS - (Date.now() - this.last));
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.dirty) return;
      this.flush();
      void wait;
    }, wait);
  }

  flush(): void {
    try {
      localStorage.setItem(KEY, serializeProject(this.doc.getState()));
      this.last = Date.now();
      this.dirty = false;
    } catch {
      /* storage full or unavailable — ignore */
    }
  }

  hasSaved(): boolean {
    try {
      return localStorage.getItem(KEY) != null;
    } catch {
      return false;
    }
  }

  /** Restore the autosaved project if present. Returns true if restored. */
  restore(): boolean {
    try {
      const text = localStorage.getItem(KEY);
      if (!text) return false;
      this.doc.loadState(deserializeProject(text));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    this.dirty = false;
  }

  get savedAt(): number {
    return this.last;
  }
}
