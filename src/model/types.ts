// Core, serializable document model for SpriteForge.
// All pixel data is palette-indexed: a cel is an Int-length array of numbers
// where -1 means "transparent" and any value >= 0 indexes into the palette.

export type ToolId = 'pencil' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill' | 'picker';

export const CANVAS_SIZE = 32;
export const DISPLAY_SIZE = 512;
export const MAX_FRAMES = 64;
export const MAX_DURATION = 24;
export const MAX_FPS = 24;

/** A layer's metadata (pixel data lives on the frame cels, indexed by layer). */
export interface LayerState {
  id: string;
  name: string;
  visible: boolean;
  /** 0..100 percent, applied as alpha during compositing. */
  opacity: number;
}

/** A single frame: a hold duration plus one cel per layer (aligned to DocState.layers). */
export interface FrameState {
  /** 1..MAX_DURATION units of the playback rate. */
  duration: number;
  /** cels[layerIndex] has length width*height; entries are -1 or a palette index. */
  cels: number[][];
}

/** The full editable, serializable document state (the "model"). */
export interface DocState {
  width: number;
  height: number;
  /** Palette colors as "#rrggbb". Index 0 is never the eraser; transparency is -1. */
  palette: string[];
  /** Index into palette for the currently selected drawing color. */
  activeColor: number;
  /** Draw order: index 0 is the bottom layer, the last entry is on top. */
  layers: LayerState[];
  frames: FrameState[];
  activeFrame: number;
  /** Index into layers for the active drawing target. */
  activeLayer: number;
  /** 1..MAX_FPS. */
  fps: number;
  loop: boolean;
  onionSkin: boolean;
  /** 0..100 percent opacity for the onion-skin ghost of the previous frame. */
  onionOpacity: number;
  tool: ToolId;
  /** 1 or 2 pixels. */
  brushSize: number;
}

export const DEFAULT_PALETTE: string[] = [
  '#000000',
  '#1f1f1f',
  '#5a5a5a',
  '#9a9a9a',
  '#ffffff',
  '#e43b44',
  '#287f79',
  '#8d6f47',
  '#7f80f4',
  '#e3b5a3',
  '#c4524b',
  '#689e86',
  '#a7a7a7',
  '#6f98bd',
  '#d9d9d9',
  '#c4b39b',
];

export interface PalettePreset {
  name: string;
  colors: string[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { name: 'Default 16', colors: DEFAULT_PALETTE.slice() },
  {
    name: 'Gameboy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  {
    name: 'Sweetie 16',
    colors: [
      '#1a1c2c',
      '#5d275d',
      '#b13e53',
      '#ef7d57',
      '#ffcd75',
      '#a7f070',
      '#38b764',
      '#257179',
      '#29366f',
      '#3b5dc9',
      '#41a6f6',
      '#73eff7',
      '#f4f4f4',
      '#94b0c2',
      '#566c86',
      '#333c57',
    ],
  },
];

export const MAX_LAYERS = 32;

let idCounter = 0;
/** Collision-resistant enough for a single-user local session. */
export function makeLayerId(): string {
  idCounter += 1;
  return `layer-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function emptyCel(width: number, height: number): number[] {
  return new Array<number>(width * height).fill(-1);
}

export function createLayer(name: string): LayerState {
  return { id: makeLayerId(), name, visible: true, opacity: 100 };
}

/** A fresh document with the default palette and four layers / one frame. */
export function createInitialState(): DocState {
  const width = CANVAS_SIZE;
  const height = CANVAS_SIZE;
  const layerNames = ['Background', 'Character', 'Props', 'FX'];
  const layers: LayerState[] = layerNames.map((name) => createLayer(name));
  const cels = layers.map((_, i) => {
    const cel = emptyCel(width, height);
    // Give the bottom layer a soft checker-ish backdrop-free default of transparency.
    if (i === 0) {
      /* leave transparent on purpose */
    }
    return cel;
  });
  return {
    width,
    height,
    palette: DEFAULT_PALETTE.slice(),
    activeColor: 0,
    layers,
    frames: [{ duration: 4, cels }],
    activeFrame: 0,
    activeLayer: 0,
    fps: 8,
    loop: true,
    onionSkin: false,
    onionOpacity: 30,
    tool: 'pencil',
    brushSize: 1,
  };
}
