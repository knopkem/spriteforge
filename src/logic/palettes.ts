import { hexToPacked } from './pixels';

export type PaletteName = 'warm' | 'cool' | 'grayscale';

export const PALETTES: Record<PaletteName, string[]> = {
  // reds / oranges / browns
  warm: [
    '#1e1e2e', '#4a2c2a', '#6e3b2e', '#8a4b2f',
    '#a85a32', '#c26a33', '#d9822b', '#e89b3c',
    '#f2b45a', '#f7d27a', '#b23a48', '#d1495b',
    '#ef6351', '#8c5a3c', '#5c4033', '#fff0d4',
  ],
  // blues / greens / purples
  cool: [
    '#1e1e2e', '#1d3a5f', '#26486e', '#2d5a8a',
    '#3a6ea5', '#4a8fc0', '#5aa9e6', '#89b4fa',
    '#2a9d8f', '#43b0a3', '#5cc9b0', '#7bd8bf',
    '#5b4a8a', '#7161a8', '#8f7bc4', '#e8f6ef',
  ],
  grayscale: [
    '#000000', '#16161d', '#2a2a35', '#3b3b48',
    '#4c4c5a', '#5d5d6e', '#6e6e80', '#808090',
    '#909090', '#a6a6a6', '#bcbcbc', '#d0d0d0',
    '#dcdcdc', '#e6e6e6', '#f0f0f0', '#ffffff',
  ],
};

export function getPreset(name: PaletteName): string[] {
  return [...PALETTES[name]];
}

export function presetToPacked(name: PaletteName): number[] {
  return PALETTES[name].map(hexToPacked);
}
