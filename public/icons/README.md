# KoreDB icons

Every file here is generated from a single source of truth in
[`scripts/generate-icons.ts`](../../scripts/generate-icons.ts). Edit the geometry there and
regenerate — do not hand-edit the output.

```bash
yarn generate-icons
```

## The mark

A letter `K` whose strokes are graph edges: the terminals are nodes, and the joint where the
strokes converge is replaced by a core. Drawn on a 32 × 32 grid, ink box 21.7 × 27.2, optically
centred.

The core is always ember (`#dc6428`, the site accent from `src/styles/custom.css`); the graph
structure is ink (`#17181c`) on light grounds and chalk (`#edeef3`) on dark ones.

## Files

| File | Use |
| --- | --- |
| `favicon.svg` | Primary favicon. Follows the OS colour scheme via `prefers-color-scheme`. |
| `favicon.ico` | Fallback for clients that ignore SVG favicons. Packs 16/32/48. |
| `favicon-{16,32,48}x{...}.png` | The individual rasters inside the `.ico`. |
| `icon-{64,128,192,256,512}.png` | App and PWA icons, transparent ground, ink structure. |
| `icon-{192,512}-inverse.png` | Same sizes for dark grounds, chalk structure. |
| `apple-touch-icon.png` | 180 × 180, opaque ink ground — iOS composites transparency onto black. |
| `icon-maskable-512.png` | Android maskable. Content sits inside the centre 80% safe circle. |
| `koredb-mark.svg` | Vector mark, light grounds. |
| `koredb-mark-inverse.svg` | Vector mark, dark grounds. |
| `koredb-mark-mono.svg` | Single-colour mark using `currentColor` — inherits surrounding text colour. |
| `koredb-logo{,-inverse}.svg` | Horizontal lockup (mark + wordmark). Mirrored into `src/assets/logo/`. |
| `koredb-logo{,-inverse}.png` | Raster lockup at 256px tall, for contexts that can't take SVG. |

The 16px and 32px rasters use a slightly heavier cut of the mark (thicker strokes, larger nodes)
so the strokes stay solid at small sizes.

## Wired up in

- `astro.config.mjs` — `favicon`, the `logo` pair, and the `link` tags for `.ico` / apple-touch.
- `src/assets/logo/` — the lockup Starlight renders in the site header.

## Wordmark

"KoreDB" is set in [Archivo](https://fonts.google.com/specimen/Archivo) SemiBold and converted to
outlines, so no font is loaded at build or render time. Archivo is licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/), which permits this use.
