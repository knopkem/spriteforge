// Playback clock. Uses setTimeout keyed to the active frame's hold duration at
// the current fps so timing edits apply live. Advances the document's active
// frame and respects the loop flag.

import type { Document } from '../model/document';

export class Playback {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  constructor(private doc: Document, private onTick: () => void) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.schedule();
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  toggle(): void {
    if (this.playing) this.stop();
    else this.play();
  }

  private schedule(): void {
    const s = this.doc.getState();
    const frame = s.frames[s.activeFrame];
    const ms = Math.max(16, (frame.duration / s.fps) * 1000);
    this.timer = setTimeout(() => this.advance(), ms);
  }

  private advance(): void {
    if (!this.playing) return;
    const s = this.doc.getState();
    const next = s.activeFrame + 1;
    if (next >= s.frames.length) {
      if (s.loop) {
        this.doc.setActiveFrame(0);
        this.onTick();
        this.schedule();
      } else {
        this.stop();
        this.onTick();
      }
    } else {
      this.doc.setActiveFrame(next);
      this.onTick();
      this.schedule();
    }
  }
}
