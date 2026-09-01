import { WIDTH, HEIGHT, SCALE } from '../types';

let scratch: HTMLCanvasElement | null = null;

function scratchCanvas(): CanvasRenderingContext2D {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = WIDTH;
    scratch.height = HEIGHT;
  }
  const ctx = scratch.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  return ctx;
}

/**
 * Paint an RGBA (length WIDTH*HEIGHT*4) buffer onto a display canvas that is
 * SCALE times larger, with pixelated (nearest-neighbour) scaling.
 */
export function paintRgba(
  displayCtx: CanvasRenderingContext2D,
  rgba: Uint8ClampedArray,
  displaySize: number,
): void {
  const ctx = scratchCanvas();
  const image = new ImageData(new Uint8ClampedArray(rgba), WIDTH, HEIGHT);
  ctx.putImageData(image, 0, 0);
  displayCtx.imageSmoothingEnabled = false;
  displayCtx.clearRect(0, 0, displaySize, displaySize);
  displayCtx.drawImage(ctx.canvas, 0, 0, WIDTH, HEIGHT, 0, 0, displaySize, displaySize);
}

export { SCALE };
