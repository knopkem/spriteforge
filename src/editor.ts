import { SCALE, WIDTH, HEIGHT } from './types';
import type { BrushSize, Tool } from './types';
import { createDocument } from './state/document';
import { History, restore, snapshot } from './state/history';
import { composite, sampleTopmost } from './logic/compose';
import { onionComposite } from './logic/onionSkin';
import { floodFill } from './logic/floodFill';
import { stamp } from './logic/pencil';
import { colorToHex, hexToPacked } from './logic/pixels';
import { getPreset, PALETTES } from './logic/palettes';
import type { PaletteName } from './logic/palettes';
import { paintRgba } from './render/render';
import { buildPngBlob, downloadBlob, downloadBytes } from './export/png';
import { buildGif } from './export/gif';

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'pencil', icon: '✎', label: 'Pencil (left draw / right erase)' },
  { id: 'fill', icon: '🪣', label: 'Bucket fill' },
  { id: 'eyedropper', icon: '🎨', label: 'Eyedropper' },
];

const PRESETS: { id: PaletteName; label: string }[] = [
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'grayscale', label: 'Gray' },
];

function q<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

export class Editor {
  private doc = createDocument();
  private history = new History();
  private activeFrame = 0;
  private activeLayer = 2;
  private tool: Tool = 'pencil';
  private brush: BrushSize = 1;
  private palette: string[] = getPreset('warm');
  private activeColorIndex = 6;
  private onion = false;
  private playing = false;
  private playTimer: number | null = null;

  private stroking = false;
  private erasing = false;
  private lastCell: { x: number; y: number } | null = null;

  private mainCtx: CanvasRenderingContext2D;
  private gridCtx: CanvasRenderingContext2D;
  private canvas = q<HTMLCanvasElement>('main-canvas');

  constructor() {
    const main = this.canvas.getContext('2d');
    const grid = q<HTMLCanvasElement>('grid-canvas').getContext('2d');
    if (!main || !grid) throw new Error('2D context unavailable');
    this.mainCtx = main;
    this.gridCtx = grid;

    this.buildToolbar();
    this.buildPalette();
    this.buildLayers();
    this.buildFilmstrip();
    this.bindCanvas();
    this.bindKeys();
    this.drawGrid();
    this.render();
  }

  // ---- helpers ----
  private frame() {
    return this.doc.frames[this.activeFrame];
  }

  private activeColorPacked(): number {
    return hexToPacked(this.palette[this.activeColorIndex]);
  }

  private cellFromEvent(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / WIDTH));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / HEIGHT));
    return { x, y };
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
  }

  // ---- toolbar ----
  private buildToolbar(): void {
    const bar = q('toolbar');
    bar.innerHTML = '';
    for (const t of TOOLS) {
      const b = document.createElement('button');
      b.className = 'tool-btn' + (this.tool === t.id ? ' active' : '');
      b.title = t.label;
      b.textContent = t.icon;
      b.dataset.tool = t.id;
      b.addEventListener('click', () => {
        this.tool = t.id;
        bar.querySelectorAll<HTMLButtonElement>('.tool-btn[data-tool]').forEach((el) =>
          el.classList.toggle('active', el.dataset.tool === this.tool),
        );
      });
      bar.appendChild(b);
    }

    const sep1 = document.createElement('div');
    sep1.className = 'tool-sep';
    bar.appendChild(sep1);

    const brushBtn = document.createElement('button');
    brushBtn.className = 'tool-btn';
    brushBtn.title = `Brush: ${this.brush}px (click to toggle)`;
    brushBtn.textContent = `${this.brush}px`;
    brushBtn.addEventListener('click', () => {
      this.brush = this.brush === 1 ? 2 : 1;
      brushBtn.textContent = `${this.brush}px`;
      brushBtn.title = `Brush: ${this.brush}px (click to toggle)`;
    });
    bar.appendChild(brushBtn);

    const sep2 = document.createElement('div');
    sep2.className = 'tool-sep';
    bar.appendChild(sep2);

    const undo = document.createElement('button');
    undo.className = 'tool-btn';
    undo.id = 'undo-btn';
    undo.title = 'Undo (Ctrl+Z)';
    undo.textContent = '↶';
    undo.addEventListener('click', () => this.undo());
    bar.appendChild(undo);

    const redo = document.createElement('button');
    redo.className = 'tool-btn';
    redo.id = 'redo-btn';
    redo.title = 'Redo (Ctrl+Shift+Z)';
    redo.textContent = '↷';
    redo.addEventListener('click', () => this.redo());
    bar.appendChild(redo);

    const sep3 = document.createElement('div');
    sep3.className = 'tool-sep';
    bar.appendChild(sep3);

    const png = document.createElement('button');
    png.className = 'tool-btn';
    png.title = 'Export frame as PNG (32x32)';
    png.textContent = 'PNG';
    png.style.fontSize = '12px';
    png.addEventListener('click', () => void this.exportPng());
    bar.appendChild(png);

    const gif = document.createElement('button');
    gif.className = 'tool-btn';
    gif.title = 'Export animation as GIF (4 frames @ 250ms)';
    gif.textContent = 'GIF';
    gif.style.fontSize = '12px';
    gif.addEventListener('click', () => void this.exportGif());
    bar.appendChild(gif);
  }

  // ---- palette ----
  private buildPalette(): void {
    const row = q('palette');
    row.innerHTML = '';
    this.palette.forEach((hex, i) => {
      const s = document.createElement('button');
      s.className = 'swatch' + (i === this.activeColorIndex ? ' active' : '');
      s.style.background = hex;
      s.title = `${hex} (slot ${i})`;
      s.addEventListener('click', () => {
        this.activeColorIndex = i;
        this.refreshPalette();
      });
      s.dataset.idx = String(i);
      row.appendChild(s);
    });

    const presets = q('presets');
    presets.innerHTML = '';
    for (const p of PRESETS) {
      const c = document.createElement('button');
      c.className = 'chip' + (this.isPresetActive(p.id) ? ' active' : '');
      c.textContent = p.label;
      c.dataset.preset = p.id;
      c.addEventListener('click', () => {
        this.palette = getPreset(p.id);
        this.refreshPalette();
        presets.querySelectorAll<HTMLElement>('.chip').forEach((el) =>
          el.classList.toggle('active', el.dataset.preset === p.id),
        );
      });
      presets.appendChild(c);
    }
  }

  private isPresetActive(name: PaletteName): boolean {
    const ref = PALETTES[name];
    return ref.length === this.palette.length && ref.every((c, i) => c === this.palette[i]);
  }

  private refreshPalette(): void {
    const row = q('palette');
    row.querySelectorAll<HTMLElement>('.swatch').forEach((el) => {
      const i = Number(el.dataset.idx);
      el.style.background = this.palette[i];
      el.title = `${this.palette[i]} (slot ${i})`;
      el.classList.toggle('active', i === this.activeColorIndex);
    });
    const presets = q('presets');
    presets.querySelectorAll<HTMLElement>('.chip').forEach((el) =>
      el.classList.toggle('active', this.isPresetActive(el.dataset.preset as PaletteName)),
    );
  }

  // ---- layers ----
  private buildLayers(): void {
    const panel = q('layers');
    panel.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Layers';
    panel.appendChild(title);

    const layers = this.frame().layers;
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      const row = document.createElement('div');
      row.className = 'layer-row' + (li === this.activeLayer ? ' active' : '');
      row.dataset.layer = String(li);

      const head = document.createElement('div');
      head.className = 'layer-head';

      const eye = document.createElement('span');
      eye.className = 'eye' + (layer.visible ? '' : ' off');
      eye.textContent = layer.visible ? '👁' : '🚫';
      eye.title = 'Toggle visibility';
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        eye.textContent = layer.visible ? '👁' : '🚫';
        eye.classList.toggle('off', !layer.visible);
        this.render();
      });

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;
      name.addEventListener('click', () => {
        this.activeLayer = li;
        this.refreshLayers();
      });

      head.appendChild(eye);
      head.appendChild(name);

      const sliderWrap = document.createElement('div');
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.className = 'layer-opacity';
      slider.value = String(layer.opacity);
      slider.addEventListener('click', (e) => e.stopPropagation());
      slider.addEventListener('input', () => {
        layer.opacity = Number(slider.value);
        this.render();
      });
      sliderWrap.appendChild(slider);

      row.appendChild(head);
      row.appendChild(sliderWrap);
      row.addEventListener('click', () => {
        this.activeLayer = li;
        this.refreshLayers();
      });
      panel.appendChild(row);
    }
  }

  private refreshLayers(): void {
    q('layers')
      .querySelectorAll<HTMLElement>('.layer-row')
      .forEach((row) => row.classList.toggle('active', Number(row.dataset.layer) === this.activeLayer));
  }

  // ---- filmstrip ----
  private buildFilmstrip(): void {
    const controls = q('anim-controls');
    controls.innerHTML = '';

    const play = document.createElement('button');
    play.className = 'chip';
    play.id = 'play-btn';
    play.textContent = '▶ Play';
    play.addEventListener('click', () => this.togglePlay());
    controls.appendChild(play);

    const onionBtn = document.createElement('button');
    onionBtn.className = 'chip';
    onionBtn.id = 'onion-btn';
    onionBtn.textContent = '🧅 Onion';
    onionBtn.classList.toggle('active', this.onion);
    onionBtn.addEventListener('click', () => {
      this.onion = !this.onion;
      onionBtn.classList.toggle('active', this.onion);
      this.render();
    });
    controls.appendChild(onionBtn);

    const strip = q('filmstrip');
    strip.innerHTML = '';
    this.doc.frames.forEach((_, fi) => {
      const c = document.createElement('canvas');
      c.width = WIDTH;
      c.height = HEIGHT;
      c.className = 'frame-thumb' + (fi === this.activeFrame ? ' active' : '');
      c.dataset.frame = String(fi);
      c.style.width = '60px';
      c.style.height = '60px';
      c.addEventListener('click', () => {
        this.activeFrame = fi;
        this.refreshFilmstrip();
        this.render();
      });
      strip.appendChild(c);
    });
  }

  private refreshFilmstrip(): void {
    q('filmstrip')
      .querySelectorAll<HTMLElement>('.frame-thumb')
      .forEach((el) => el.classList.toggle('active', Number(el.dataset.frame) === this.activeFrame));
  }

  // ---- canvas interaction ----
  private bindCanvas(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.playing) return;
      const { x, y } = this.cellFromEvent(e);
      if (!this.inBounds(x, y)) return;
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);

      if (this.tool === 'eyedropper') {
        const px = sampleTopmost(this.frame().layers, y * WIDTH + x);
        if (px !== 0) {
          this.palette[this.activeColorIndex] = colorToHex(px);
          this.refreshPalette();
        }
        return;
      }

      if (this.tool === 'fill') {
        this.history.push(snapshot(this.doc));
        floodFill(this.frame().layers[this.activeLayer].pixels, x, y, this.activeColorPacked());
        this.render();
        this.updateUndoRedo();
        return;
      }

      // pencil: begin stroke
      this.stroking = true;
      this.erasing = e.button === 2;
      this.lastCell = { x, y };
      this.history.push(snapshot(this.doc));
      this.paintStamp(x, y);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.stroking) return;
      const { x, y } = this.cellFromEvent(e);
      if (this.lastCell) this.lineStamp(this.lastCell, { x, y });
      this.lastCell = { x, y };
    });

    const end = () => {
      if (!this.stroking) return;
      this.stroking = false;
      this.lastCell = null;
      this.updateUndoRedo();
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private paintStamp(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const color = this.erasing ? 0 : this.activeColorPacked();
    stamp(this.frame().layers[this.activeLayer].pixels, x, y, this.brush, color);
    this.render();
  }

  private lineStamp(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;
    let { x, y } = from;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.paintStamp(x, y);
      if (x === to.x && y === to.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // ---- undo / redo ----
  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if (key === 'y') {
        e.preventDefault();
        this.redo();
      }
    });
  }

  private undo(): void {
    const prev = this.history.undo(this.doc);
    if (!prev) return;
    restore(this.doc, prev);
    this.render();
    this.updateUndoRedo();
  }

  private redo(): void {
    const next = this.history.redo(this.doc);
    if (!next) return;
    restore(this.doc, next);
    this.render();
    this.updateUndoRedo();
  }

  private updateUndoRedo(): void {
    const u = document.getElementById('undo-btn') as HTMLButtonElement | null;
    const r = document.getElementById('redo-btn') as HTMLButtonElement | null;
    if (u) u.disabled = !this.history.canUndo();
    if (r) r.disabled = !this.history.canRedo();
  }

  // ---- playback ----
  private togglePlay(): void {
    this.playing = !this.playing;
    const btn = q<HTMLElement>('play-btn');
    if (this.playing) {
      btn.textContent = '⏸ Pause';
      btn.classList.add('active');
      this.playTimer = window.setInterval(() => {
        this.activeFrame = (this.activeFrame + 1) % this.doc.frames.length;
        this.refreshFilmstrip();
        this.render();
      }, 250); // 4 FPS
    } else {
      btn.textContent = '▶ Play';
      btn.classList.remove('active');
      if (this.playTimer !== null) window.clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  // ---- export ----
  private async exportPng(): Promise<void> {
    const blob = await buildPngBlob(this.frame().layers);
    downloadBlob(blob, `frame-${this.activeFrame}.png`);
  }

  private async exportGif(): Promise<void> {
    const bytes = buildGif(this.doc.frames);
    downloadBytes(bytes, 'animation.gif', 'image/gif');
  }

  // ---- rendering ----
  private drawGrid(): void {
    const c = this.gridCtx;
    c.clearRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE);
    c.strokeStyle = 'rgba(205,214,244,0.07)';
    c.lineWidth = 1;
    for (let i = 0; i <= WIDTH; i++) {
      const p = i * SCALE + 0.5;
      c.beginPath();
      c.moveTo(p, 0);
      c.lineTo(p, HEIGHT * SCALE);
      c.stroke();
      c.beginPath();
      c.moveTo(0, p);
      c.lineTo(WIDTH * SCALE, p);
      c.stroke();
    }
  }

  private render(): void {
    const layers = this.frame().layers;
    const rgba =
      this.onion && this.activeFrame > 0
        ? onionComposite(layers, this.doc.frames[this.activeFrame - 1].layers)
        : composite(layers);
    paintRgba(this.mainCtx, rgba, WIDTH * SCALE);
    this.paintThumbs();
  }

  private paintThumbs(): void {
    q('filmstrip')
      .querySelectorAll<HTMLCanvasElement>('.frame-thumb')
      .forEach((c) => {
        const fi = Number(c.dataset.frame);
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        const img = new ImageData(composite(this.doc.frames[fi].layers), WIDTH, HEIGHT);
        ctx.putImageData(img, 0, 0);
      });
  }
}
