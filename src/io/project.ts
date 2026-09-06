// `.spriteforge` project file format: a JSON document (see README for the
// documented schema). Cels are RLE-encoded for compactness but the round-trip
// is lossless for pixels, palette, layers, frame order, durations, fps,
// onion/loop state and tool settings.

import type { DocState, FrameState, LayerState, ToolId } from '../model/types';
import { isValidHex } from '../model/color';
import { rleDecode, rleEncode } from './rle';

export const PROJECT_FORMAT = 'spriteforge';
export const PROJECT_VERSION = 1;

interface CelDTO {
  rle: string;
}
interface FrameDTO {
  duration: number;
  cels: CelDTO[];
}
interface LayerDTO {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}
export interface ProjectDTO {
  format: typeof PROJECT_FORMAT;
  version: number;
  doc: {
    width: number;
    height: number;
    palette: string[];
    activeColor: number;
    layers: LayerDTO[];
    frames: FrameDTO[];
    activeFrame: number;
    activeLayer: number;
    fps: number;
    loop: boolean;
    onionSkin: boolean;
    onionOpacity: number;
    tool: ToolId;
    brushSize: number;
  };
}

const TOOLS: ToolId[] = ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'fill', 'picker'];

export function serializeProject(state: DocState): string {
  const dto: ProjectDTO = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    doc: {
      width: state.width,
      height: state.height,
      palette: state.palette.slice(),
      activeColor: state.activeColor,
      layers: state.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity })),
      frames: state.frames.map((f) => ({
        duration: f.duration,
        cels: f.cels.map((cel) => ({ rle: rleEncode(cel) })),
      })),
      activeFrame: state.activeFrame,
      activeLayer: state.activeLayer,
      fps: state.fps,
      loop: state.loop,
      onionSkin: state.onionSkin,
      onionOpacity: state.onionOpacity,
      tool: state.tool,
      brushSize: state.brushSize,
    },
  };
  return JSON.stringify(dto, null, 0);
}

function isTool(v: unknown): v is ToolId {
  return typeof v === 'string' && (TOOLS as string[]).includes(v);
}

export function deserializeProject(text: string): DocState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not a valid .spriteforge file: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Project is not an object');
  const dto = parsed as Partial<ProjectDTO>;
  if (dto.format !== PROJECT_FORMAT) throw new Error('Not a spriteforge project (missing format tag)');
  if (dto.version !== PROJECT_VERSION) throw new Error(`Unsupported project version: ${dto.version}`);
  const d = dto.doc;
  if (!d) throw new Error('Project missing doc');
  if (
    typeof d.width !== 'number' ||
    typeof d.height !== 'number' ||
    d.width <= 0 ||
    d.height <= 0
  ) {
    throw new Error('Project has invalid dimensions');
  }
  if (!Array.isArray(d.palette) || d.palette.length === 0 || !d.palette.every(isValidHex)) {
    throw new Error('Project has an invalid palette');
  }
  if (!Array.isArray(d.layers) || d.layers.length === 0) throw new Error('Project has no layers');
  if (!Array.isArray(d.frames) || d.frames.length === 0) throw new Error('Project has no frames');
  const pixelCount = d.width * d.height;

  const layers: LayerState[] = d.layers.map((l, i) => ({
    id: typeof l.id === 'string' ? l.id : `layer-${i}`,
    name: typeof l.name === 'string' ? l.name : `Layer ${i + 1}`,
    visible: l.visible !== false,
    opacity: clampInt(l.opacity, 0, 100, 100),
  }));

  const frames: FrameState[] = d.frames.map((f) => {
    if (!Array.isArray(f.cels) || f.cels.length !== layers.length) {
      throw new Error('A frame has the wrong number of layers');
    }
    const cels = f.cels.map((cel) => {
      const decoded = rleDecode(cel.rle, pixelCount);
      for (const v of decoded) {
        if (v < -1 || v >= d.palette.length) throw new Error('Cel references a color outside the palette');
      }
      return decoded;
    });
    return { duration: clampInt(f.duration, 1, 24, 4), cels };
  });

  const state: DocState = {
    width: d.width,
    height: d.height,
    palette: d.palette.slice(),
    activeColor: clampInt(d.activeColor, 0, d.palette.length - 1, 0),
    layers,
    frames,
    activeFrame: clampInt(d.activeFrame, 0, frames.length - 1, 0),
    activeLayer: clampInt(d.activeLayer, 0, layers.length - 1, 0),
    fps: clampInt(d.fps, 1, 24, 8),
    loop: d.loop !== false,
    onionSkin: d.onionSkin === true,
    onionOpacity: clampInt(d.onionOpacity, 0, 100, 30),
    tool: isTool(d.tool) ? d.tool : 'pencil',
    brushSize: d.brushSize === 2 ? 2 : 1,
  };
  return state;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
