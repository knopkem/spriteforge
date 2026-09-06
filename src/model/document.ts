// The Document is the mutable model the UI drives. It owns the DocState plus
// unlimited snapshot-based undo/redo, and exposes named operations for every
// editing action. Pure state (DocState) lives in types.ts; everything here is
// framework-agnostic and unit-tested.

import {
  type DocState,
  type LayerState,
  createInitialState,
  createLayer,
  emptyCel,
  MAX_DURATION,
  MAX_FPS,
  MAX_FRAMES,
  MAX_LAYERS,
} from './types';
import { compositeFrame, compositeOnChecker } from './composite';
import { type RGBA } from './composite';

/**
 * Ephemeral view fields the user is not "editing" — these should survive an
 * undo/redo so stepping through history doesn't yank the active tool, brush,
 * color, selected frame/layer, or playback settings back in time. Document data
 * (palette, layers, cels, frame count/durations) still reverts normally; only
 * indices are clamped so they stay in range for the restored shape.
 */
function preserveView(current: DocState, restored: DocState): DocState {
  const view: Pick<
    DocState,
    | 'tool'
    | 'brushSize'
    | 'activeColor'
    | 'activeFrame'
    | 'activeLayer'
    | 'fps'
    | 'loop'
    | 'onionSkin'
    | 'onionOpacity'
  > = {
    tool: current.tool,
    brushSize: current.brushSize,
    activeColor: Math.min(current.activeColor, restored.palette.length - 1),
    activeFrame: Math.min(current.activeFrame, restored.frames.length - 1),
    activeLayer: Math.min(current.activeLayer, restored.layers.length - 1),
    fps: current.fps,
    loop: current.loop,
    onionSkin: current.onionSkin,
    onionOpacity: current.onionOpacity,
  };
  return Object.assign(restored, view);
}

export class History {
  private undo: DocState[] = [];
  private redo: DocState[] = [];

  constructor(private get: () => DocState, private set: (s: DocState) => void) {}

  push(): void {
    this.undo.push(structuredClone(this.get()));
    this.redo.length = 0;
  }

  undoStep(): boolean {
    if (!this.undo.length) return false;
    this.redo.push(structuredClone(this.get()));
    this.set(preserveView(this.get(), this.undo.pop() as DocState));
    return true;
  }

  redoStep(): boolean {
    if (!this.redo.length) return false;
    this.undo.push(structuredClone(this.get()));
    this.set(preserveView(this.get(), this.redo.pop() as DocState));
    return true;
  }

  get canUndo(): boolean {
    return this.undo.length > 0;
  }

  get canRedo(): boolean {
    return this.redo.length > 0;
  }

  /** Drop all history (used after loading a project or clearing). */
  clear(): void {
    this.undo.length = 0;
    this.redo.length = 0;
  }

  get depth(): number {
    return this.undo.length;
  }
}

type Listener = () => void;

export class Document {
  private state: DocState;
  private history: History;
  private listeners = new Set<Listener>();

  constructor(state?: DocState) {
    this.state = state ? structuredClone(state) : createInitialState();
    this.history = new History(
      () => this.state,
      (s) => {
        this.state = s;
      }
    );
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  getState(): DocState {
    return this.state;
  }

  /** Replace the whole document (used for load/new). Resets history. */
  loadState(state: DocState): void {
    this.state = structuredClone(state);
    this.history.clear();
    this.emit();
  }

  // ---- history controls -------------------------------------------------

  /** Snapshot the current state as the undo point. Call before a mutation. */
  pushHistory(): void {
    this.history.push();
    this.emit();
  }

  undo(): void {
    if (this.history.undoStep()) this.emit();
  }

  redo(): void {
    if (this.history.redoStep()) this.emit();
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  // ---- active cel helpers ----------------------------------------------

  getActiveCel(): number[] {
    const s = this.state;
    const frame = s.frames[s.activeFrame];
    return frame.cels[s.activeLayer];
  }

  /** Write paletteIndex (-1 to erase) at each point. Does NOT push history. */
  applyPoints(points: ReadonlyArray<readonly [number, number]>, paletteIndex: number): void {
    const s = this.state;
    const cel = this.getActiveCel();
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= s.width || y >= s.height) continue;
      cel[y * s.width + x] = paletteIndex;
    }
    this.emit();
  }

  /** Read the composited color index at a pixel (topmost visible layer). */
  pickIndexAt(x: number, y: number): number {
    const s = this.state;
    if (x < 0 || y < 0 || x >= s.width || y >= s.height) return -1;
    const frame = s.frames[s.activeFrame];
    const p = y * s.width + x;
    // Top-most wins, so iterate from the last layer downward.
    for (let li = s.layers.length - 1; li >= 0; li--) {
      if (!s.layers[li].visible) continue;
      const idx = frame.cels[li][p];
      if (idx >= 0) return idx;
    }
    return -1;
  }

  /**
   * Write RGBA pixels (from an imported image) into the active cel, quantizing
   * to the current palette. Fully transparent source pixels stay transparent.
   */
  importRgbaIntoActiveCel(rgba: Uint8ClampedArray, quantize: (r: number, g: number, b: number, a: number) => number): void {
    const s = this.state;
    const cel = this.getActiveCel();
    for (let p = 0; p < s.width * s.height; p++) {
      const a = rgba[p * 4 + 3];
      if (a < 8) {
        cel[p] = -1;
        continue;
      }
      cel[p] = quantize(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2], a);
    }
    this.emit();
  }

  // ---- settings ---------------------------------------------------------

  setTool(tool: DocState['tool']): void {
    this.state.tool = tool;
    this.emit();
  }

  setBrushSize(size: number): void {
    this.state.brushSize = size === 2 ? 2 : 1;
    this.emit();
  }

  cycleBrush(dir: 1 | -1): void {
    const next = this.state.brushSize === 1 ? 2 : 1;
    this.state.brushSize = next;
    void dir;
    this.emit();
  }

  setActiveColor(index: number): void {
    if (index >= 0 && index < this.state.palette.length) {
      this.state.activeColor = index;
      this.emit();
    }
  }

  setFps(fps: number): void {
    this.state.fps = clamp(fps, 1, MAX_FPS);
    this.emit();
  }

  setLoop(loop: boolean): void {
    this.state.loop = loop;
    this.emit();
  }

  setOnionSkin(on: boolean): void {
    this.state.onionSkin = on;
    this.emit();
  }

  setOnionOpacity(v: number): void {
    this.state.onionOpacity = clamp(v, 0, 100);
    this.emit();
  }

  // ---- palette ----------------------------------------------------------

  addColor(hex: string): number {
    this.history.push();
    this.state.palette.push(hex);
    this.state.activeColor = this.state.palette.length - 1;
    this.emit();
    return this.state.palette.length - 1;
  }

  setPaletteColor(index: number, hex: string): void {
    if (index < 0 || index >= this.state.palette.length) return;
    this.history.push();
    this.state.palette[index] = hex;
    this.emit();
  }

  removeColor(index: number): void {
    if (index < 0 || index >= this.state.palette.length) return;
    if (this.state.palette.length <= 1) return;
    this.history.push();
    // Remap cels: removed index -> -1, higher indices shift down by one.
    for (const frame of this.state.frames) {
      for (const cel of frame.cels) {
        for (let p = 0; p < cel.length; p++) {
          const v = cel[p];
          if (v === index) cel[p] = -1;
          else if (v > index) cel[p] = v - 1;
        }
      }
    }
    this.state.palette.splice(index, 1);
    if (this.state.activeColor >= this.state.palette.length) {
      this.state.activeColor = this.state.palette.length - 1;
    } else if (this.state.activeColor > index) {
      this.state.activeColor -= 1;
    } else if (this.state.activeColor === index) {
      this.state.activeColor = 0;
    }
    this.emit();
  }

  moveColor(from: number, to: number): void {
    const pal = this.state.palette;
    if (from < 0 || from >= pal.length || to < 0 || to >= pal.length || from === to) return;
    this.history.push();
    const activeColorIndex = pal[this.state.activeColor];
    const [moved] = pal.splice(from, 1);
    pal.splice(to, 0, moved);
    // Keep the active color pointing at the same swatch value.
    const newActive = pal.indexOf(activeColorIndex);
    this.state.activeColor = newActive >= 0 ? newActive : 0;
    this.emit();
  }

  loadPalette(colors: string[]): void {
    if (!colors.length) return;
    this.history.push();
    // Remap any out-of-range active color.
    this.state.palette = colors.slice();
    if (this.state.activeColor >= colors.length) this.state.activeColor = 0;
    this.emit();
  }

  // ---- layers -----------------------------------------------------------

  /** Insert a new empty layer above the active layer. */
  addLayer(): number {
    if (this.state.layers.length >= MAX_LAYERS) return this.state.activeLayer;
    this.history.push();
    const layer = createLayer(`Layer ${this.state.layers.length + 1}`);
    const insertAt = this.state.activeLayer + 1;
    this.state.layers.splice(insertAt, 0, layer);
    for (const frame of this.state.frames) {
      frame.cels.splice(insertAt, 0, emptyCel(this.state.width, this.state.height));
    }
    this.state.activeLayer = insertAt;
    this.emit();
    return insertAt;
  }

  deleteLayer(index: number): void {
    if (this.state.layers.length <= 1) return; // keep at least one layer
    this.history.push();
    this.state.layers.splice(index, 1);
    for (const frame of this.state.frames) frame.cels.splice(index, 1);
    if (this.state.activeLayer >= this.state.layers.length) {
      this.state.activeLayer = this.state.layers.length - 1;
    }
    this.emit();
  }

  renameLayer(index: number, name: string): void {
    if (index < 0 || index >= this.state.layers.length) return;
    this.history.push();
    this.state.layers[index].name = name;
    this.emit();
  }

  setLayerVisible(index: number, visible: boolean): void {
    if (index < 0 || index >= this.state.layers.length) return;
    this.history.push();
    this.state.layers[index].visible = visible;
    this.emit();
  }

  setLayerOpacity(index: number, opacity: number): void {
    if (index < 0 || index >= this.state.layers.length) return;
    this.history.push();
    this.state.layers[index].opacity = clamp(opacity, 0, 100);
    this.emit();
  }

  setActiveLayer(index: number): void {
    if (index < 0 || index >= this.state.layers.length) return;
    this.state.activeLayer = index;
    this.emit();
  }

  /** Move a layer up (toward top) or down by one. Returns new index. */
  moveLayer(index: number, dir: 1 | -1): number {
    const n = this.state.layers.length;
    const target = dir === 1 ? index + 1 : index - 1;
    if (target < 0 || target >= n) return index;
    this.history.push();
    swap(this.state.layers, index, target);
    for (const frame of this.state.frames) swap(frame.cels, index, target);
    if (this.state.activeLayer === index) this.state.activeLayer = target;
    else if (this.state.activeLayer === target) this.state.activeLayer = index;
    this.emit();
    return target;
  }

  /** Move a layer to an explicit index (drag reorder). */
  reorderLayer(from: number, to: number): void {
    const n = this.state.layers.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
    this.history.push();
    const activeWas = this.state.activeLayer;
    const [layer] = this.state.layers.splice(from, 1);
    this.state.layers.splice(to, 0, layer);
    for (const frame of this.state.frames) {
      const [cel] = frame.cels.splice(from, 1);
      frame.cels.splice(to, 0, cel);
    }
    this.state.activeLayer = reindex(activeWas, from, to);
    this.emit();
  }

  // ---- frames -----------------------------------------------------------

  addFrame(): number {
    if (this.state.frames.length >= MAX_FRAMES) return this.state.activeFrame;
    this.history.push();
    const cels = this.state.layers.map(() => emptyCel(this.state.width, this.state.height));
    const prev = this.state.frames[this.state.activeFrame];
    const idx = this.state.activeFrame + 1;
    this.state.frames.splice(idx, 0, { duration: prev ? prev.duration : 4, cels });
    this.state.activeFrame = idx;
    this.emit();
    return idx;
  }

  duplicateFrame(index: number): number {
    if (this.state.frames.length >= MAX_FRAMES) return this.state.activeFrame;
    this.history.push();
    const src = this.state.frames[index];
    const cels = src.cels.map((c) => c.slice());
    const idx = index + 1;
    this.state.frames.splice(idx, 0, { duration: src.duration, cels });
    this.state.activeFrame = idx;
    this.emit();
    return idx;
  }

  deleteFrame(index: number): void {
    if (this.state.frames.length <= 1) return; // keep at least one frame
    this.history.push();
    this.state.frames.splice(index, 1);
    if (this.state.activeFrame >= this.state.frames.length) {
      this.state.activeFrame = this.state.frames.length - 1;
    }
    this.emit();
  }

  reorderFrame(from: number, to: number): void {
    const n = this.state.frames.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
    this.history.push();
    const activeWas = this.state.activeFrame;
    const [frame] = this.state.frames.splice(from, 1);
    this.state.frames.splice(to, 0, frame);
    this.state.activeFrame = reindex(activeWas, from, to);
    this.emit();
  }

  setActiveFrame(index: number): void {
    if (index < 0 || index >= this.state.frames.length) return;
    this.state.activeFrame = index;
    this.emit();
  }

  setFrameDuration(index: number, duration: number): void {
    if (index < 0 || index >= this.state.frames.length) return;
    this.history.push();
    this.state.frames[index].duration = clamp(Math.round(duration), 1, MAX_DURATION);
    this.emit();
  }

  // ---- rendering helpers ------------------------------------------------

  composite(frameIndex = this.state.activeFrame): RGBA {
    return compositeFrame(this.state, frameIndex);
  }

  compositeChecker(frameIndex = this.state.activeFrame): RGBA {
    return compositeOnChecker(this.state, frameIndex);
  }

  get width(): number {
    return this.state.width;
  }

  get height(): number {
    return this.state.height;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function swap<T>(arr: T[], a: number, b: number): void {
  const t = arr[a];
  arr[a] = arr[b];
  arr[b] = t;
}

/** Where an index lands after moving `from` to position `to` (array splice semantics). */
function reindex(old: number, from: number, to: number): number {
  let result = old;
  if (old === from) result = to;
  else if (from < to && old > from && old <= to) result = old - 1;
  else if (from > to && old >= to && old < from) result = old + 1;
  return result;
}

export type { LayerState };
