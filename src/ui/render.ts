// Canvas rendering: composes the model into an RGBA buffer (checker background,
// optional onion-skin ghost, optional in-progress shape preview) and blits it to
// a display canvas with nearest-neighbor scaling. Pure compositing lives in the
// model; this file only assembles display pixels and paints pixels.

import type { DocState } from '../model/types';
import type { RGBA } from '../model/composite';
import { compositeFrame, compositeOnChecker } from '../model/composite';
import { hexToRgb } from '../model/color';

function blendOver(dst: RGBA, src: RGBA, alphaScale: number): void {
  if (alphaScale <= 0) return;
  const n = dst.width * dst.height;
  for (let p = 0; p < n; p++) {
    const o = p * 4;
    const srcA = (src.data[o + 3] / 255) * alphaScale;
    if (srcA <= 0) continue;
    const dstA = dst.data[o + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    const inv = 1 - srcA;
    dst.data[o] = (src.data[o] * srcA + dst.data[o] * dstA * inv) / outA;
    dst.data[o + 1] = (src.data[o + 1] * srcA + dst.data[o + 1] * dstA * inv) / outA;
    dst.data[o + 2] = (src.data[o + 2] * srcA + dst.data[o + 2] * dstA * inv) / outA;
    dst.data[o + 3] = outA * 255;
  }
}

/** Build the full editor RGBA (checker + onion ghost + current frame + preview). */
export function buildDisplay(
  state: DocState,
  preview?: { points: ReadonlyArray<readonly [number, number]>; color: string }
): RGBA {
  const base = compositeOnChecker(state, state.activeFrame);

  if (state.onionSkin && state.activeFrame > 0) {
    const ghost = compositeFrame(state, state.activeFrame - 1);
    blendOver(base, ghost, state.onionOpacity / 100);
  }

  const current = compositeFrame(state, state.activeFrame);
  blendOver(base, current, 1);

  if (preview && preview.points.length) {
    const [r, g, b] = hexToRgb(preview.color);
    for (const [x, y] of preview.points) {
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
      const o = (y * state.width + x) * 4;
      base.data[o] = r;
      base.data[o + 1] = g;
      base.data[o + 2] = b;
      base.data[o + 3] = 255;
    }
  }
  return base;
}

function blitScaled(target: HTMLCanvasElement, img: RGBA, smoothing: boolean): void {
  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  off.getContext('2d')!.putImageData(
    new ImageData(new Uint8ClampedArray(img.data), img.width, img.height),
    0,
    0
  );
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingEnabled = smoothing;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(off, 0, 0, target.width, target.height);
}

/** Paint the current editor state onto the main canvas. */
export function renderEditor(
  canvas: HTMLCanvasElement,
  state: DocState,
  preview?: { points: ReadonlyArray<readonly [number, number]>; color: string }
): void {
  blitScaled(canvas, buildDisplay(state, preview), false);
}

/** Paint a frame thumbnail onto a small canvas (transparent background kept). */
export function renderThumb(canvas: HTMLCanvasElement, state: DocState, frameIndex: number): void {
  blitScaled(canvas, compositeFrame(state, frameIndex), false);
}
