import { WIDTH, HEIGHT } from '../types';
import type { Layer } from '../types';
import { composite } from '../logic/compose';

/** Render the visible composite of a frame to a 32x32 PNG blob. */
export function buildPngBlob(layers: Layer[]): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('2D context unavailable'));
  const rgba = composite(layers);
  ctx.putImageData(new ImageData(rgba, WIDTH, HEIGHT), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  downloadBlob(new Blob([bytes.slice().buffer], { type: mime }), filename);
}
