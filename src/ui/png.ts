// Browser-only export helpers: turn an RGBA8 buffer into a PNG blob and trigger
// downloads. Kept out of the pure IO layer so the encoders stay testable in node.

import type { RGBA } from '../model/composite';

/** Allocate a detached RGBA buffer sized for ImageData (browser). */
export function makeImageData(rgba: RGBA): ImageData {
  return new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height);
}

/** Encode an RGBA buffer at native size to a PNG blob via a temporary canvas. */
export function pngBlob(rgba: RGBA): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = rgba.width;
  canvas.height = rgba.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(makeImageData(rgba), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))),
      'image/png'
    );
  });
}

/** Encode an RGBA buffer upscaled by an integer factor with nearest-neighbor. */
export function pngBlobScaled(rgba: RGBA, scale: number): Promise<Blob> {
  const small = document.createElement('canvas');
  small.width = rgba.width;
  small.height = rgba.height;
  small.getContext('2d')!.putImageData(makeImageData(rgba), 0, 0);

  const big = document.createElement('canvas');
  big.width = rgba.width * scale;
  big.height = rgba.height * scale;
  const ctx = big.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, big.width, big.height);
  return new Promise((resolve, reject) => {
    big.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

export function gifBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice()], { type: 'image/gif' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = 'application/json'): void {
  downloadBlob(new Blob([text], { type }), filename);
}
