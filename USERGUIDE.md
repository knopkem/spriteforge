# User Guide

SpriteForge is a single-page sprite studio. Everything happens on one screen:
the **canvas** (center), the **filmstrip + playback** bar (bottom-left), and the
**Tools / Palette / Layers** sidebar (right). A **top bar** holds file and export
actions, and a **status line** shows the current tool, size, frame, layer, and FPS.

> **Focus matters for keyboard shortcuts.** Tool and playback keys only fire while
> the canvas area has focus — click the canvas (or press `Tab` to it) to enable
> them. This keeps typing in text fields (color hex, layer names) from being
> hijacked. `Ctrl/⌘+Z` undo/redo work from anywhere.

## 1. Canvas & drawing

The canvas is a 32×32 pixel grid shown at 512×512 with crisp nearest-neighbor
upscaling. Draw directly with the pointer.

### Tools

| Tool          | Key   | Behaviour |
| ------------- | ----- | --------- |
| Pencil        | `B`   | Left-click paints with the active color; **right-click erases**. Click-drag paints a stroke. |
| Eraser        | `E`   | Paints transparency (`-1`). Also available by right-clicking with the pencil. |
| Line          | `L`   | Drag to preview a straight line; release to commit. |
| Rectangle     | `R`   | Drag to preview an outlined rectangle; release to commit. |
| Ellipse       | `O`   | Drag to preview an outlined ellipse in the drag's bounding box; release to commit. |
| Bucket Fill   | `G`   | Click a pixel to flood-fill its contiguous region with the active color. |
| Eyedropper    | `I`   | Click a pixel to make its color the active drawing color. |

You can also click a tool in the **Tools** panel; it returns focus to the canvas
so the keyboard stays usable.

### Brush size

Two sizes are available: **1px** and **2px**.

- Click **1px / 2px** in the Tools panel, or
- press `[` for 1px and `]` for 2px.

The brush applies to the pencil, eraser, and shape tools.

### Undo / redo

Unlimited history of every edit (draws, fills, palette/layer/frame changes).

- Undo: `Ctrl/⌘ + Z`
- Redo: `Ctrl/⌘ + Shift + Z` (or `Ctrl/⌘ + Y`)
- Buttons: **Undo** / **Redo** in the Tools panel.

Undo/redo restore document content but **keep your current tool, brush, active
color, active frame/layer, FPS, loop, and onion settings**, so you stay where you
were working.

## 2. Palette

The palette is a list of colors; pixels reference palette entries. The **active
color swatch** (top-left of the Palette panel) shows what you're currently drawing
with.

- **Choose a color** — click any swatch in the grid to make it active.
- **Custom color** — use the native color picker to set an off-palette color, then
  click **Add** to append it to the palette.
- **Remove a color** — right-click a swatch.
- **Reorder colors** — select a swatch, then use the **◀ / ▶** buttons to move the
  active color left/right within the palette.
- **Presets** — the **preset** dropdown swaps in a whole palette (e.g. Default 16,
  Game Boy, Sweetie 16). Your document starts from the 16-color default palette.

The palette you build is saved inside your `.spriteforge` project.

## 3. Layers

Layers composite bottom-to-top; the panel lists the **topmost layer first**. The
document starts with four layers (Background, Character, Props, FX).

For each layer, the panel row shows a **visibility eye** toggle, an **editable
name**, and an **opacity** slider (0–100%) with live alpha compositing.

- **Select** a layer by clicking its row (drawing goes to the active layer).
- **Rename** by double-clicking the name and typing a new one.
- **Toggle visibility** with the eye icon.
- **Adjust opacity** with the row's slider.
- **Add / Delete** with the panel buttons.
- **Reorder** with the **▲ / ▼** buttons (moves the active layer up/down in the
  stack).

## 4. Frames & animation

The **filmstrip** shows a thumbnail per frame; the active frame is highlighted.
Draw edits the active frame on the active layer. The document supports up to 64
frames.

### Frame operations

- **Select / scrub** — click any thumbnail to jump to that frame.
- **Add frame** — insert a new empty frame after the active one.
- **Duplicate** — copy the active frame into a new frame.
- **Delete** — remove the active frame.
- **Reorder** — **◀ Move / Move ▶** shift the active frame left/right.
- **Step** — `←` / `→` (or the ⏮ / ⏭ buttons) move one frame; stepping stops playback.

### Playback

The playback bar runs the animation at the chosen **FPS** (1–24).

- **Play / Pause** — `Space` or the ▶ button (toggles).
- **Stop** — ■ button (pauses and returns to frame 1).
- **Step back / forward** — ⏮ / ⏭ buttons, or `←` / `→`.
- **Loop** — checkbox; when off, playback stops at the last frame.
- **FPS** — number field (1–24) setting the base rate.

### Per-frame hold & onion skin

- **Hold** — the active frame's duration in playback units (1–24). A hold of *n*
  shows the frame *n* units (≈ `n / fps` seconds), letting some frames linger.
- **Onion** — checkbox overlays the previous frame beneath the current one as a
  guide; **Onion α** sets its opacity (0–100%).

Onion skinning and the active-frame highlight are editing aids and are not baked
into exports.

## 5. Import & export

All actions live in the top bar.

### Save / load the project

- **Save** — downloads `spriteforge.spriteforge`, a JSON file containing the
  entire document (palette, tool settings, layers, frames, durations). Loading it
  later restores everything exactly.
- **Load** — pick a `.spriteforge` file to replace the current document.
- **New** — clear the project back to an empty document.

### Import a PNG into the active layer/frame

- **Import PNG** opens a file picker; you can also **drag a PNG onto the canvas**.
- Images larger than 32×32 are downscaled with nearest-neighbor and quantized to
  the current palette (preserving transparent pixels), then written into the
  active layer of the active frame.

### Export images

- **PNG 32** — the composited current frame at true size (32×32), transparent
  background.
- **PNG 512** — the same frame upscaled to 512×512.
- **Spritesheet** — all frames laid out in a row-major grid; choose cell **Pad**
  (0, 1, or 2px) from the dropdown before exporting.
- **GIF** — the full animation as an animated GIF, honoring each frame's hold
  duration at the current FPS, with transparency preserved.

## 6. Autosave

Your work is autosaved to browser `localStorage` at most once every 5 seconds and
restored automatically when you reload the page. Use **New** to clear the saved
project and start fresh.

## Keyboard shortcut reference

| Keys                       | Action |
| -------------------------- | ------ |
| `B`                        | Pencil tool |
| `E`                        | Eraser tool |
| `L`                        | Line tool |
| `R`                        | Rectangle tool |
| `O`                        | Ellipse tool |
| `G`                        | Bucket fill |
| `I`                        | Eyedropper |
| `[`                        | Brush size 1px |
| `]`                        | Brush size 2px |
| `Space`                    | Play / pause |
| `←` / `→`                  | Step to previous / next frame |
| `Ctrl/⌘ + Z`               | Undo |
| `Ctrl/⌘ + Shift + Z`       | Redo |
| `Ctrl/⌘ + Y`               | Redo (alternate) |
| Right-click (pencil)       | Erase |
| Double-click layer name    | Rename layer |

Remember: tool/playback keys need the **canvas area focused**; undo/redo work
everywhere; none of them fire while you're typing in a text field.
