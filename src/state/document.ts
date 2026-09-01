import { PIXELS } from '../types';
import type { Document, Frame, Layer } from '../types';

const LAYER_NAMES = ['Background', 'Midground', 'Foreground'] as const;

export function newLayer(id: string, name: string, opacity = 100): Layer {
  return {
    id,
    name,
    visible: true,
    opacity,
    pixels: new Uint32Array(PIXELS),
  };
}

export function newFrame(index: number): Frame {
  return {
    layers: LAYER_NAMES.map((name, li) => newLayer(`f${index}-l${li}`, name)),
  };
}

export function createDocument(frameCount = 4): Document {
  return {
    frames: Array.from({ length: frameCount }, (_, i) => newFrame(i)),
  };
}

export function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map((l) => ({
    id: l.id,
    name: l.name,
    visible: l.visible,
    opacity: l.opacity,
    pixels: l.pixels.slice(),
  }));
}
