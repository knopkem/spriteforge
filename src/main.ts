import { Document } from './model/document';
import {
  type DocState,
  type ToolId,
  MAX_LAYERS,
  PALETTE_PRESETS,
  createInitialState,
} from './model/types';
import {
  brushPoints,
  brushStroke,
  ellipsePoints,
  floodFill,
  linePoints,
  rectPoints,
} from './model/geometry';
import { nearestPaletteIndex } from './model/color';
import { compositeFrame } from './model/composite';
import { serializeProject, deserializeProject } from './io/project';
import { buildSpritesheet } from './io/spritesheet';
import { encodeGif } from './io/gif';
import { resampleNearest } from './io/import';
import type { RGBA } from './model/composite';
import { renderEditor, renderThumb } from './ui/render';
import { downloadBlob, downloadText, gifBlob, pngBlob, pngBlobScaled } from './ui/png';
import { Playback } from './ui/playback';
import { Autosave } from './ui/autosave';

// ---- DOM helpers -------------------------------------------------------

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

const canvas = $<HTMLCanvasElement>('canvas');
const canvasArea = $<HTMLElement>('canvas-area');
const statusEl = $<HTMLElement>('status');
const filmstripEl = $<HTMLElement>('filmstrip');
const layersEl = $<HTMLElement>('layers');
const paletteEl = $<HTMLElement>('palette-grid');
const toolsEl = $<HTMLElement>('tools');
const frameReadout = $<HTMLElement>('frame-readout');
const layerCount = $<HTMLElement>('layer-count');
const activeSwatch = $<HTMLElement>('active-swatch');
const colorPicker = $<HTMLInputElement>('color-picker');

// ---- App state ---------------------------------------------------------

const doc = new Document();
const autosave = new Autosave(doc);
let playback: Playback;

const TOOLS: { id: ToolId; glyph: string; label: string; key: string }[] = [
  { id: 'pencil', glyph: '✎', label: 'Pencil', key: 'B' },
  { id: 'eraser', glyph: '⌫', label: 'Eraser', key: 'E' },
  { id: 'line', glyph: '/', label: 'Line', key: 'L' },
  { id: 'rect', glyph: '▭', label: 'Rect', key: 'R' },
  { id: 'ellipse', glyph: '◯', label: 'Ellipse', key: 'O' },
  { id: 'fill', glyph: '▨', label: 'Fill', key: 'G' },
  { id: 'picker', glyph: '⊙', label: 'Picker', key: 'I' },
];

// ---- render scheduling -------------------------------------------------

let renderQueued = false;
function requestRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

// Shape-drag preview (not yet committed to the model).
let preview: { points: ReadonlyArray<readonly [number, number]>; color: string } | null = null;

let lastPalSig = '';
let lastLayerSig = '';
let lastFrameSig = '';

function render(): void {
  const s = doc.getState();
  renderEditor(canvas, s, preview ?? undefined);

  // Palette grid rebuild only when colors change; selection is a class toggle.
  const palSig = s.palette.join(',');
  if (palSig !== lastPalSig) {
    lastPalSig = palSig;
    buildPalette();
  }
  updatePaletteSelection();

  // Layers list rebuilds on identity/name/visibility changes.
  const layerSig = `${s.layers.length}|${s.layers
    .map((l) => `${l.id}:${l.name}:${l.visible ? 1 : 0}`)
    .join('|')}`;
  if (layerSig !== lastLayerSig) {
    lastLayerSig = layerSig;
    buildLayers();
  }
  updateLayersSelection();

  // Filmstrip rebuilds when the set of frames or the layer stack changes.
  const frameSig = `${s.frames.length}:${s.frames.map((f) => f.duration).join(',')}#${layerSig}`;
  if (frameSig !== lastFrameSig) {
    lastFrameSig = frameSig;
    buildFilmstrip();
  }
  updateFilmstrip();

  updateControls();
}

// ---- canvas pointer interaction ---------------------------------------

type Pt = [number, number];
let drawing = false;
let erasing = false;
let lastPt: Pt | null = null;
let shapeStart: Pt | null = null;

function eventPixel(e: PointerEvent): Pt {
  const rect = canvas.getBoundingClientRect();
  const s = doc.getState();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * s.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * s.height);
  return [Math.max(0, Math.min(s.width - 1, x)), Math.max(0, Math.min(s.height - 1, y))];
}

function drawAt(pt: Pt): void {
  const s = doc.getState();
  const value = erasing ? -1 : s.activeColor;
  if (lastPt) {
    const pts = brushStroke(lastPt[0], lastPt[1], pt[0], pt[1], s.brushSize, s.width, s.height);
    doc.applyPoints(pts, value);
  } else {
    doc.applyPoints(brushPoints(pt[0], pt[1], s.brushSize, s.width, s.height), value);
  }
  lastPt = pt;
}

function shapePoints(a: Pt, b: Pt): ReadonlyArray<readonly [number, number]> {
  const s = doc.getState();
  if (s.tool === 'line') return linePoints(a[0], a[1], b[0], b[1]);
  if (s.tool === 'rect') return rectPoints(a[0], a[1], b[0], b[1]);
  if (s.tool === 'ellipse') return ellipsePoints(a[0], a[1], b[0], b[1]);
  return [];
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvasArea.focus();
  const s = doc.getState();
  const pt = eventPixel(e);
  erasing = e.button === 2 || s.tool === 'eraser';

  if (s.tool === 'picker') {
    const idx = doc.pickIndexAt(pt[0], pt[1]);
    if (idx >= 0) doc.setActiveColor(idx);
    return;
  }
  if (s.tool === 'fill') {
    doc.pushHistory();
    const cel = doc.getActiveCel();
    const target = cel[pt[1] * s.width + pt[0]];
    const replacement = erasing ? -1 : s.activeColor;
    const pts = floodFill(cel, s.width, s.height, pt[0], pt[1], target, replacement);
    doc.applyPoints(pts, replacement);
    return;
  }
  if (s.tool === 'pencil' || s.tool === 'eraser') {
    doc.pushHistory();
    drawing = true;
    lastPt = null;
    drawAt(pt);
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  // line / rect / ellipse
  shapeStart = pt;
  preview = { points: shapePoints(pt, pt), color: s.palette[s.activeColor] };
  canvas.setPointerCapture(e.pointerId);
  requestRender();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing && !shapeStart) return;
  const pt = eventPixel(e);
  if (drawing) {
    drawAt(pt);
  } else if (shapeStart) {
    preview = { points: shapePoints(shapeStart, pt), color: doc.getState().palette[doc.getState().activeColor] };
    requestRender();
  }
});

function endStroke(): void {
  if (drawing) {
    drawing = false;
    lastPt = null;
  } else if (shapeStart) {
    if (preview && preview.points.length) {
      doc.pushHistory();
      doc.applyPoints(preview.points, erasing ? -1 : doc.getState().activeColor);
    }
    shapeStart = null;
    preview = null;
    requestRender();
  }
}

canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- keyboard (focus-gated so typing in fields is never hijacked) ------

const TOOL_KEYS: Record<string, ToolId> = {
  b: 'pencil',
  e: 'eraser',
  l: 'line',
  r: 'rect',
  o: 'ellipse',
  g: 'fill',
  i: 'picker',
};

function hasCanvasFocus(): boolean {
  const a = document.activeElement;
  return a === canvasArea || (a != null && canvasArea.contains(a));
}

window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
    return; // let the field keep the keystroke
  }
  const meta = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();

  // Undo/redo are conventional and never clobber typing, so they work globally.
  if (meta && k === 'z') {
    e.preventDefault();
    if (e.shiftKey) doc.redo();
    else doc.undo();
    return;
  }
  if (meta && k === 'y') {
    e.preventDefault();
    doc.redo();
    return;
  }
  if (meta) return; // don't hijack other browser shortcuts

  // Everything else is scoped to the canvas area, per the spec.
  if (!hasCanvasFocus()) return;

  if (TOOL_KEYS[k]) {
    doc.setTool(TOOL_KEYS[k]);
    return;
  }
  if (k === '[') {
    doc.setBrushSize(1);
    return;
  }
  if (k === ']') {
    doc.setBrushSize(2);
    return;
  }
  if (k === ' ') {
    e.preventDefault();
    playback.toggle();
    return;
  }
  if (k === 'arrowleft' || k === 'arrowright') {
    const s = doc.getState();
    const next = s.activeFrame + (k === 'arrowright' ? 1 : -1);
    if (next >= 0 && next < s.frames.length) {
      playback.stop();
      doc.setActiveFrame(next);
    }
  }
});

// ---- palette panel -----------------------------------------------------

function buildPalette(): void {
  const s = doc.getState();
  paletteEl.textContent = '';
  s.palette.forEach((hex, i) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = hex;
    sw.title = `${hex} — click select, right-click delete`;
    sw.addEventListener('click', () => doc.setActiveColor(i));
    sw.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (s.palette.length > 1) doc.removeColor(i);
    });
    paletteEl.appendChild(sw);
  });
}

function updatePaletteSelection(): void {
  const s = doc.getState();
  Array.from(paletteEl.children).forEach((el, i) => {
    el.classList.toggle('active', i === s.activeColor);
  });
  activeSwatch.querySelector('.fill')?.remove();
  const fill = document.createElement('div');
  fill.className = 'fill';
  fill.style.background = s.palette[s.activeColor];
  activeSwatch.appendChild(fill);
  colorPicker.value = s.palette[s.activeColor];
}

$<HTMLInputElement>('btn-add-color').addEventListener('click', () => {
  doc.addColor(colorPicker.value);
});
$<HTMLButtonElement>('btn-palette-left').addEventListener('click', () => {
  const i = doc.getState().activeColor;
  if (i > 0) doc.moveColor(i, i - 1);
});
$<HTMLButtonElement>('btn-palette-right').addEventListener('click', () => {
  const s = doc.getState();
  if (s.activeColor < s.palette.length - 1) doc.moveColor(s.activeColor, s.activeColor + 1);
});
colorPicker.addEventListener('change', () => {
  doc.setPaletteColor(doc.getState().activeColor, colorPicker.value);
});

const presetSelect = $<HTMLSelectElement>('preset-select');
PALETTE_PRESETS.forEach((p, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = p.name;
  presetSelect.appendChild(opt);
});
presetSelect.addEventListener('change', () => {
  const preset = PALETTE_PRESETS[Number(presetSelect.value)];
  if (preset) doc.loadPalette(preset.colors);
});

// ---- tools panel -------------------------------------------------------

function buildTools(): void {
  toolsEl.textContent = '';
  for (const t of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.tool = t.id;
    btn.innerHTML = `<span class="g">${t.glyph}</span><span>${t.label}</span><span class="kbd">${t.key}</span>`;
    btn.addEventListener('click', () => {
      doc.setTool(t.id);
      canvasArea.focus();
    });
    toolsEl.appendChild(btn);
  }
}

// ---- brush / undo buttons ---------------------------------------------

const brushSeg = $<HTMLElement>('brush-seg');
brushSeg.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button[data-size]') as HTMLButtonElement | null;
  if (btn) {
    doc.setBrushSize(Number(btn.dataset.size));
    canvasArea.focus();
  }
});
$<HTMLButtonElement>('btn-undo').addEventListener('click', () => doc.undo());
$<HTMLButtonElement>('btn-redo').addEventListener('click', () => doc.redo());

// ---- layers panel ------------------------------------------------------

function buildLayers(): void {
  const s = doc.getState();
  layersEl.textContent = '';
  // Composite order: topmost layer first. Storage is bottom-to-top, so display
  // the reversed order while keeping each row bound to its real index.
  for (let i = s.layers.length - 1; i >= 0; i--) {
    const layer = s.layers[i];
    const row = document.createElement('div');
    row.className = 'layer';
    row.dataset.index = String(i);

    const vis = document.createElement('span');
    vis.className = 'vis';
    vis.textContent = layer.visible ? '●' : '○';
    vis.title = 'Toggle visibility';
    vis.addEventListener('click', (ev) => {
      ev.stopPropagation();
      doc.setLayerVisible(i, !doc.getState().layers[i].visible);
    });

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = layer.name;
    name.addEventListener('dblclick', () => {
      const next = window.prompt('Layer name', doc.getState().layers[i].name);
      if (next != null) doc.renameLayer(i, next);
    });

    const op = document.createElement('input');
    op.className = 'opacity';
    op.type = 'range';
    op.min = '0';
    op.max = '100';
    op.value = String(layer.opacity);
    op.title = 'Opacity';
    op.addEventListener('change', () => doc.setLayerOpacity(i, Number(op.value)));

    row.append(vis, name, op);
    row.addEventListener('click', () => doc.setActiveLayer(i));
    layersEl.appendChild(row);
  }
}

function updateLayersSelection(): void {
  const s = doc.getState();
  layerCount.textContent = `${s.layers.length}/${MAX_LAYERS}`;
  Array.from(layersEl.children).forEach((row) => {
    const i = Number((row as HTMLElement).dataset.index);
    row.classList.toggle('active', i === s.activeLayer);
    const op = row.querySelector('input.opacity') as HTMLInputElement | null;
    if (op && document.activeElement !== op) op.value = String(s.layers[i].opacity);
  });
}

$<HTMLButtonElement>('btn-layer-add').addEventListener('click', () => doc.addLayer());
$<HTMLButtonElement>('btn-layer-del').addEventListener('click', () => doc.deleteLayer(doc.getState().activeLayer));
$<HTMLButtonElement>('btn-layer-up').addEventListener('click', () => doc.moveLayer(doc.getState().activeLayer, 1));
$<HTMLButtonElement>('btn-layer-down').addEventListener('click', () => doc.moveLayer(doc.getState().activeLayer, -1));

// ---- filmstrip ---------------------------------------------------------

function buildFilmstrip(): void {
  const s = doc.getState();
  filmstripEl.textContent = '';
  s.frames.forEach((_, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.index = String(i);
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = String(i + 1);
    const dur = document.createElement('span');
    dur.className = 'dur';
    thumb.append(c, idx, dur);
    thumb.addEventListener('click', () => {
      playback.stop();
      doc.setActiveFrame(i);
    });
    filmstripEl.appendChild(thumb);
    renderThumb(c, doc.getState(), i);
  });
}

function updateFilmstrip(): void {
  const s = doc.getState();
  frameReadout.textContent = `${s.activeFrame + 1} / ${s.frames.length}`;
  Array.from(filmstripEl.children).forEach((thumb) => {
    const i = Number((thumb as HTMLElement).dataset.index);
    thumb.classList.toggle('active', i === s.activeFrame);
    const dur = thumb.querySelector('.dur');
    if (dur) dur.textContent = `${s.frames[i].duration}u`;
    if (i === s.activeFrame) {
      const c = thumb.querySelector('canvas') as HTMLCanvasElement | null;
      if (c) renderThumb(c, s, i);
    }
  });
}

// ---- playback & frame tools -------------------------------------------

$<HTMLButtonElement>('btn-play').addEventListener('click', () => playback.toggle());
$<HTMLButtonElement>('btn-stop').addEventListener('click', () => {
  playback.stop();
  doc.setActiveFrame(0);
});
$<HTMLButtonElement>('btn-back').addEventListener('click', () => {
  playback.stop();
  doc.setActiveFrame(Math.max(0, doc.getState().activeFrame - 1));
});
$<HTMLButtonElement>('btn-forward').addEventListener('click', () => {
  playback.stop();
  doc.setActiveFrame(Math.min(doc.getState().frames.length - 1, doc.getState().activeFrame + 1));
});

const fpsInput = $<HTMLInputElement>('fps');
fpsInput.addEventListener('change', () => doc.setFps(Number(fpsInput.value)));
const loopInput = $<HTMLInputElement>('loop');
loopInput.addEventListener('change', () => doc.setLoop(loopInput.checked));
const durationInput = $<HTMLInputElement>('duration');
durationInput.addEventListener('change', () =>
  doc.setFrameDuration(doc.getState().activeFrame, Number(durationInput.value))
);
$<HTMLButtonElement>('btn-frame-add').addEventListener('click', () => doc.addFrame());
$<HTMLButtonElement>('btn-frame-dup').addEventListener('click', () => doc.duplicateFrame(doc.getState().activeFrame));
$<HTMLButtonElement>('btn-frame-del').addEventListener('click', () => doc.deleteFrame(doc.getState().activeFrame));
$<HTMLButtonElement>('btn-frame-left').addEventListener('click', () => {
  const i = doc.getState().activeFrame;
  if (i > 0) doc.reorderFrame(i, i - 1);
});
$<HTMLButtonElement>('btn-frame-right').addEventListener('click', () => {
  const s = doc.getState();
  if (s.activeFrame < s.frames.length - 1) doc.reorderFrame(s.activeFrame, s.activeFrame + 1);
});
$<HTMLInputElement>('onion').addEventListener('change', (e) =>
  doc.setOnionSkin((e.target as HTMLInputElement).checked)
);
$<HTMLInputElement>('onion-opacity').addEventListener('input', (e) =>
  doc.setOnionOpacity(Number((e.target as HTMLInputElement).value))
);

// ---- controls sync (inputs reflect model) -----------------------------

function updateControls(): void {
  const s = doc.getState();
  Array.from(toolsEl.children).forEach((el) =>
    el.classList.toggle('active', (el as HTMLElement).dataset.tool === s.tool)
  );
  Array.from(brushSeg.querySelectorAll('button')).forEach((b) =>
    (b as HTMLButtonElement).classList.toggle('active', Number((b as HTMLElement).dataset.size) === s.brushSize)
  );
  $<HTMLButtonElement>('btn-undo').disabled = !doc.canUndo;
  $<HTMLButtonElement>('btn-redo').disabled = !doc.canRedo;
  if (document.activeElement !== fpsInput) fpsInput.value = String(s.fps);
  if (document.activeElement !== loopInput) loopInput.checked = s.loop;
  if (document.activeElement !== durationInput) durationInput.value = String(s.frames[s.activeFrame].duration);
  $<HTMLInputElement>('onion').checked = s.onionSkin;
  $<HTMLInputElement>('onion-opacity').value = String(s.onionOpacity);

  statusEl.textContent = `${s.tool} · ${s.width}×${s.height} · frame ${s.activeFrame + 1}/${s.frames.length} · layer "${s.layers[s.activeLayer].name}" · ${s.fps} fps`;
}

// ---- import / export ---------------------------------------------------

function frameRgba(state: DocState, frameIndex: number): RGBA {
  const c = compositeFrame(state, frameIndex);
  return { width: c.width, height: c.height, data: c.data };
}

$<HTMLButtonElement>('btn-export-png32').addEventListener('click', async () => {
  const s = doc.getState();
  downloadBlob(await pngBlob(frameRgba(s, s.activeFrame)), `sprite-frame${s.activeFrame + 1}.png`);
});

$<HTMLButtonElement>('btn-export-png512').addEventListener('click', async () => {
  const s = doc.getState();
  downloadBlob(await pngBlobScaled(frameRgba(s, s.activeFrame), 16), `sprite-frame${s.activeFrame + 1}@16x.png`);
});

$<HTMLButtonElement>('btn-export-sheet').addEventListener('click', async () => {
  const s = doc.getState();
  const frames = s.frames.map((_, i) => frameRgba(s, i));
  const cols = Math.ceil(Math.sqrt(frames.length));
  const padding = Number($<HTMLSelectElement>('sheet-padding').value);
  const sheet = buildSpritesheet(frames, cols, padding);
  const rgba: RGBA = { width: sheet.width, height: sheet.height, data: sheet.data };
  downloadBlob(await pngBlob(rgba), 'spritesheet.png');
});

$<HTMLButtonElement>('btn-export-gif').addEventListener('click', async () => {
  const s = doc.getState();
  const gif = encodeGif(
    s.frames.map((f, i) => ({ rgba: frameRgba(s, i), duration: f.duration })),
    { palette: s.palette, fps: s.fps, loop: s.loop }
  );
  downloadBlob(gifBlob(gif), 'animation.gif');
});

// ---- project save / load / new ----------------------------------------

$<HTMLButtonElement>('btn-save').addEventListener('click', () => {
  autosave.flush();
  downloadText(serializeProject(doc.getState()), 'spriteforge.spriteforge');
});

$<HTMLButtonElement>('btn-new').addEventListener('click', () => {
  if (!window.confirm('Start a new project? Unsaved work will be lost.')) return;
  playback.stop();
  doc.loadState(createInitialState());
  autosave.clear();
});

const fileLoad = $<HTMLInputElement>('file-load');
$<HTMLButtonElement>('btn-load').addEventListener('click', () => fileLoad.click());
fileLoad.addEventListener('change', async () => {
  const file = fileLoad.files?.[0];
  if (!file) return;
  try {
    doc.loadState(deserializeProject(await file.text()));
    autosave.scheduleSave();
  } catch (err) {
    window.alert(`Could not load project: ${(err as Error).message}`);
  } finally {
    fileLoad.value = '';
  }
});

// ---- PNG import --------------------------------------------------------

async function importPngFromFile(file: File): Promise<void> {
  const bmp = await createImageBitmap(file);
  const tmp = document.createElement('canvas');
  tmp.width = bmp.width;
  tmp.height = bmp.height;
  tmp.getContext('2d')!.drawImage(bmp, 0, 0);
  const img = tmp.getContext('2d')!.getImageData(0, 0, bmp.width, bmp.height);
  const src: RGBA = { width: bmp.width, height: bmp.height, data: img.data };
  const s = doc.getState();
  const resampled = resampleNearest(src, s.width, s.height);
  doc.pushHistory();
  const palette = s.palette.slice();
  doc.importRgbaIntoActiveCel(resampled.data, (r, g, b) => nearestPaletteIndex(palette, [r, g, b]));
  bmp.close();
}

const filePng = $<HTMLInputElement>('file-import-png');
$<HTMLButtonElement>('btn-import-png').addEventListener('click', () => filePng.click());
filePng.addEventListener('change', async () => {
  const file = filePng.files?.[0];
  if (file) await importPngFromFile(file);
  filePng.value = '';
});

canvasArea.addEventListener('dragover', (e) => e.preventDefault());
canvasArea.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (file.name.endsWith('.spriteforge')) {
    doc.loadState(deserializeProject(await file.text()));
  } else {
    await importPngFromFile(file);
  }
});

// ---- boot --------------------------------------------------------------

function boot(): void {
  buildTools();
  playback = new Playback(doc, () => requestRender());
  doc.subscribe(() => {
    requestRender();
    autosave.scheduleSave();
  });
  autosave.restore();
  render();
  canvasArea.focus();
}

boot();
