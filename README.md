# SpriteForge

A browser-based animated pixel-art sprite studio: draw frames, manage a palette
and layers, preview the animation, and export to PNG, animated GIF, or a
sprite-sheet — or save the whole project to a `.spriteforge` file. It is a
single-page app that runs entirely offline with no network calls.

Built with **TypeScript + Vite + vanilla DOM**. The only runtime dependency is
[`gifenc`](https://github.com/mattdesl/gifenc) for GIF encoding (see
[`DECISIONS.md`](./DECISIONS.md)).

## Quick start

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server (http://localhost:5173)
```

Open the printed URL. Click the canvas, then start drawing.

## Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Dev server with HMR                                      |
| `npm run build`     | `tsc --noEmit` typecheck, then `vite build` → `dist/`    |
| `npm run preview`   | Serve the production build in `dist/`                    |
| `npm test`          | Run the Vitest suite once (`vitest run`)                 |
| `npm run test:watch`| Run Vitest in watch mode                                 |
| `npm run typecheck` | Type-check the whole project without emitting            |

All three required gates — `build`, `test`, `typecheck` — are wired and green.

## Features

- **Canvas & drawing** — 32×32 canvas upscaled to 512×512 with nearest-neighbor
  rendering. Pencil (left-click draw / right-click erase) with 1px and 2px
  brushes, line, rectangle, and ellipse with live drag preview, bucket fill,
  and eyedropper. Unlimited undo/redo.
- **Palette** — 16-color default palette plus switchable presets, a native
  color picker, add/remove/reorder of swatches, and a per-document palette that
  is saved with the project.
- **Layers** — four layers by default; add, delete, rename (double-click),
  reorder, per-layer visibility and 0–100% opacity with live compositing. The
  panel lists the topmost layer first.
- **Frames & animation** — up to 64 frames in an editable filmstrip; add,
  duplicate, delete, reorder; per-frame hold duration, configurable FPS, loop
  toggle, play/pause/stop/step controls, scrubbing, and onion-skinning of the
  previous frame.
- **Import & export** — import a PNG (file picker or drag-and-drop) into the
  active layer/frame with automatic downscale + palette quantization; export the
  current frame as a 32×32 or 512×512 PNG; export the animation as an animated
  GIF honoring per-frame durations; export a row-major sprite-sheet PNG with
  0/1/2px padding; save/load the whole project losslessly.
- **Persistence** — autosaves to `localStorage` at most every 5 seconds and
  restores on reload; a **New** action clears the project.

See [`USERGUIDE.md`](./USERGUIDE.md) for a walkthrough of every feature and
keyboard shortcut.

## Project format

`.spriteforge` files are JSON: a `format: "spriteforge"`, `version: 1` envelope
around the full document state (palette, tool settings, layer metadata, and
frames), with each cel's indexed pixels RLE-compressed as `[value, runLength]`
pairs. The round-trip is lossless for pixels, palette, layers, frame order,
durations, and tool settings. See `src/io/project.ts` and `src/io/rle.ts`.

## Layout

```
index.html            app shell
src/
  main.ts             app controller: wires DOM, tools, panels, export, autosave
  model/              pure, DOM-free state & logic (unit tested)
    types.ts          DocState, constants, presets, initial state
    geometry.ts       line/rect/ellipse/range, flood fill, brush shapes
    composite.ts      layer/frame compositing to RGBA
    color.ts          hex/rgb conversion, palette matching
    document.ts       Document (all mutations) + History + preserveView()
  io/                 serialization & image codecs (unit tested)
    rle.ts            run-length encode/decode of cels
    project.ts        .spriteforge serialize/deserialize
    spritesheet.ts    row-major grid layout
    gif.ts            animated GIF via gifenc
    import.ts         nearest resample + palette quantization
  ui/                 thin browser glue (exempt from unit tests)
    render.ts         display + thumbnail compositing/scaling
    playback.ts       frame timeline playback
    autosave.ts       throttled localStorage persistence
    png.ts            canvas → PNG/GIF blobs + downloads
  types/gifenc.d.ts   type shim for the untyped gifenc dependency
```

## Testing

The pure model and I/O layers are covered by Vitest (69 tests across
`src/model/*` and `src/io/*`): geometry, compositing, color math, the document
model incl. undo/redo + view preservation, RLE, project round-trip,
spritesheet layout, GIF encoding, and import quantization. UI glue is exempt per
the spec.
