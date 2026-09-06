# DECISIONS

Append-only log. One line per decision: **what was decided — rationale.**

- Chose TypeScript + Vite + vanilla DOM — the spec names this stack and a framework would add weight a pixel-editor's imperative canvas loop doesn't need.
- Kept exactly one runtime dependency, `gifenc` — a correct, small GIF89a encoder with per-frame delays is error-prone to hand-roll, and the spec explicitly permits a small, justified GIF dependency.
- Added `src/types/gifenc.d.ts` — `gifenc` ships no types, so a local module shim keeps `npm run typecheck` clean without forking the library.
- Modeled pixels as palette-indexed `number[]` cels with `-1` = transparent — it makes the palette first-class, keeps `.spriteforge` files tiny, and makes lossless round-trips and quantization trivial.
- Stored layers bottom-to-top and composited in that order — it matches painter's-algorithm iteration and keeps the model's natural array order equal to draw order.
- Rendered the layers panel top-to-bottom while storage stays bottom-to-top — the UI convention is topmost layer at the top, so display reverses storage but each row keeps its real index.
- Implemented undo/redo as unlimited `structuredClone` snapshots — snapshotting is dead-simple, correct for all mutations, and cheap at this canvas size, so it beats hand-written inverse operations.
- Made undo/redo preserve ephemeral view fields (tool, brush, active color, active frame/layer, fps, loop, onion) via `preserveView()` — restoring a pixel snapshot should not reset what tool you're holding or which frame you're on, which would feel broken.
- Coalesced redraws through a single `requestAnimationFrame` scheduler — pencil drags fire many pointer events per frame and only the latest composite matters, so this avoids redundant full-canvas repaints.
- Cached palette/layer/filmstrip panel rebuilds by a cheap state signature and only repainted the active thumbnail every frame — rebuilding all thumbs every render janked drags, and full rebuilds are only needed when structure actually changes.
- Used the native `<input type="color">` for custom colors — it satisfies the "native color picker" requirement, works offline, and avoids building a custom picker.
- Gated single-key shortcuts on canvas-area focus (undo/redo work globally) — the spec requires shortcuts to fire "only when the canvas area has focus" without clobbering browser defaults, so editing keys are scoped to the canvas while conventional Ctrl+Z stays global and never intercepts typing.
- Scoped keyboard handling to ignore `input`/`select`/`textarea`/contenteditable targets — so typing a hex value or layer name is never stolen as a tool shortcut.
- Encoded the project as JSON with RLE-compressed cels, `format: "spriteforge"`, `version: 1` — human-inspectable, dependency-free, RLE shrinks large runs of one color, and a version tag leaves room to migrate later.
- Chose RLE that stores `[value, runLength]` pairs over per-pixel arrays — 32×32 sprites are dominated by long transparent/solid runs, so RLE collapses them with near-zero implementation cost.
- Made `.spriteforge` round-trip lossless for pixels, palette, layers, frame order, durations, and tool settings — the spec lists exactly these, so the serializer persists the full `DocState` rather than a lossy subset.
- Downscaled imported images with nearest-neighbor and quantized to the active palette with squared-RGB-distance nearest color — nearest-neighbor preserves crisp pixel edges, and palette quantization keeps the document valid for the indexed model.
- Reserved a dedicated transparent palette index for GIF export and built the rest from the document palette — it preserves transparency while keeping the exported GIF within the indexed-color limits.
- Computed GIF per-frame delay as `round(1000 / fps * duration / 10)` centiseconds from each frame's hold — it honors the spec's per-frame durations against the configurable playback rate instead of flattening to one delay.
- Built the spritesheet row-major with a configurable 0/1/2px pad selector and an auto column count — the spec fixes the grid order and padding range but leaves layout open, so columns default to a near-square `ceil(sqrt(n))`.
- Autosaved to `localStorage` throttled to at most once per 5 seconds — the spec caps the interval, and throttling (not debouncing) guarantees a recent save even during continuous drawing.
- Set the canvas backing store to native 32×32 upscaled to 512 CSS px with `image-rendering: pixelated` — it keeps crisp nearest-neighbor upscaling for editing while staying true-size for export.
- Kept all pure logic (model, geometry, compositing, encoders, serialization) framework-free and DOM-free — it makes the quality-bar target directly unit-testable under Vitest's `node` environment with no browser needed.
