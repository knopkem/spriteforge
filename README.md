# PixelEdit

A browser-based pixel art editor for retro game assets, built with a 32×32 canvas at 16× display scale. Vanilla TypeScript + Vite, no UI framework.

## Features

- **Canvas & drawing** — 32×32 canvas shown at 512×512 on a dark UI; pencil (left-draw / right-erase) with 1px/2px brush; flood-fill bucket; unlimited undo/redo.
- **Color & palette** — fixed 16-color palette with active-slot indicator and warm / cool / grayscale presets. The eyedropper samples the visible composite and writes the color into the active slot.
- **Layers** — background / midground / foreground with visibility toggles, selection, per-layer opacity, and a source-over composite preview.
- **Animation** — 4 frames with filmstrip thumbnails, onion skin (previous frame at 30% ghost), and 4 FPS play/pause.
- **Export** — current frame as a 32×32 PNG; full animation as a GIF (4 frames @ 250 ms) via [`gifenc`](https://www.npmjs.com/package/gifenc).

## Quick start

```bash
npm install
npm run dev      # start dev server
npm test         # run the vitest suite
npm run build    # typecheck + production build (dist/)
```

## Keyboard & mouse

| Action | Input |
| --- | --- |
| Draw / erase | Left / right click (pencil) |
| Fill, pick color | Click with bucket / eyedropper tool |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) |

## Architecture

Rendering and DOM live in a thin layer; all drawing/color logic is pure and unit-tested.

```
src/
  types.ts            # core model (Layer, Frame, Document)
  logic/              # pure, testable logic
    pixels.ts         # RGBA <-> packed-pixel helpers
    floodFill.ts      # region fill
    pencil.ts         # brush stamping
    compose.ts        # layer compositing + eyedropper sampling
    onionSkin.ts      # previous-frame ghost blending
    palettes.ts       # 16-color presets
  state/              # document factory + snapshot undo/redo
  render/             # canvas painting (nearest-neighbour scaling)
  export/             # PNG and GIF (gifenc)
  editor.ts           # editor controller wiring UI to logic
test/                 # vitest specs for the logic/state modules
```

Pixels are stored per layer as a `Uint32Array` packed as `0xAABBGGRR`, matching `ImageData`'s little-endian layout for direct compositing.

## Tech

TypeScript, Vite, HTML5 Canvas, vanilla DOM. `gifenc` is the only runtime dependency. Themed with the Catppuccin Mocha palette.
