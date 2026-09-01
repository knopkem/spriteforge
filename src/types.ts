export const WIDTH = 32;
export const HEIGHT = 32;
export const PIXELS = WIDTH * HEIGHT;
export const SCALE = 16;
export const DISPLAY = WIDTH * SCALE;

export type Tool = 'pencil' | 'fill' | 'eyedropper';
export type BrushSize = 1 | 2;

export interface Layer {
  readonly id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..100
  pixels: Uint32Array; // length PIXELS, packed 0xAABBGGRR (0 = transparent)
}

export interface Frame {
  layers: Layer[]; // bottom -> top
}

export interface Document {
  frames: Frame[];
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// RGBA bytes buffer guaranteed to be ArrayBuffer-backed (required by ImageData).
export type PixelBytes = Uint8ClampedArray<ArrayBuffer>;
