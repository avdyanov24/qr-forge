# QR Forge

A QR code generator that runs entirely in the browser and tells you when your design has stopped being scannable.

**[Live app →](https://avdyanov24.github.io/qr-forge/)**

[![CI](https://github.com/avdyanov24/qr-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/avdyanov24/qr-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)

## Why this exists

Most QR generators will happily hand you a code that does not scan. They let you drop a logo in the middle, pick a low error-correction level, and never mention that those two choices are in direct competition for the same budget of recoverable modules. The failure is silent — the code looks fine on screen and dies on a printed flyer.

QR Forge makes that budget visible. The logo control is expressed as a share of the error-correction budget it consumes, and the app warns before you spend it all. It also checks the things that quietly break readers: insufficient contrast between foreground and background, and inverted polarity (light modules on a dark field), which a number of older scanners will not handle.

Nothing leaves the browser. There is no backend, no upload, and no persistence — your data and your logo never touch a network.

## Demo

<!-- TODO: replace with a screenshot or GIF of the generator (see #11) -->

_Screenshot pending._

## Features

- Live preview, debounced at 300ms
- Text or URL input of any length the format supports
- Foreground and background colour, via swatch or hex entry
- Linear or radial gradient across the modules, with an adjustable angle
- Separate colour for the three finder patterns
- Dot styles: square, dots, rounded, extra rounded, classy, classy rounded
- Corner styles and corner-centre styles: square, dot, rounded
- Square or circular frame
- Adjustable quiet zone
- Error correction levels L / M / Q / H
- Centred logo upload with a quiet zone, sized against the error-correction budget
- Output size from 256px to 2048px
- Export to PNG, SVG, JPEG or WebP at the selected size
- Scan-risk analysis: recovery-budget exhaustion, faint ink, faint finder patterns, inverted polarity, undersized quiet zone
- Zoom from 50% to 400% on the preview, in either mode, with the field scrolling under it
- Responsive: the rail and preview stack on narrow screens, with export controls docked

### Layout mode

Places a finished code on a printable piece and exports it as PNG at 300 dpi, with the pixel dimensions a printer expects.

| Piece         | Trim         | Export         |
| ------------- | ------------ | -------------- |
| Bookmark      | 50 × 150 mm  | 591 × 1772 px  |
| Business card | 85 × 55 mm   | 1004 × 650 px  |
| Sticker       | 60 × 60 mm   | 709 × 709 px   |
| Flyer A6      | 105 × 148 mm | 1240 × 1748 px |
| Poster A5     | 148 × 210 mm | 1748 × 2480 px |

Each piece takes:

- **Background patterns** — waves, stripes, dots, grid, gradient, arc, or an uploaded image, with their own colour, scale and strength. Every pattern is drawn on the canvas rather than stored as a bitmap, so it stays sharp at print resolution.
- **Arrangement** — code above, below, left or right of the text; left, centre or right alignment; and a code size in millimetres.
- **Copy and marks** — headline, supporting line, and an uploaded logo for the piece itself.
- **Finish** — corner radius (the area outside it exports transparent, where a die cut would fall) and an optional keyline.

The code is drawn as an opaque image carrying its own background, so it always punches a clean rectangle through whatever is behind it. That is what keeps the quiet zone intact over a busy pattern.

Knowing the physical size buys a warning the pixel view cannot give you: **module size in millimetres**. A phone camera stops resolving modules below roughly 0.4 mm no matter how much error correction the code carries, and ink spread closes the gap further. The same code that sits at 1.09 mm on a bookmark drops to 0.21 mm once the URL grows and the piece shrinks to a business card — which is the failure that reaches the printer before anyone notices. Layout mode measures it from the module count the encoder actually produced and says so.

## How the logo budget works

This is the part worth knowing, because it is not how most tools present it.

`qr-code-styling` does not size a logo as a fraction of the code's width. It blanks at most:

```
maxHiddenDots = imageSize × eccPercent × modules²
```

where `eccPercent` is `{ L: 0.07, M: 0.15, Q: 0.25, H: 0.30 }`. So `imageSize` is the share of the _recovery budget_ the logo consumes, and a logo can never mathematically exceed what the level can recover — at level L it is simply drawn smaller.

The real failure mode is therefore margin, not overflow. A logo that spends the entire budget still decodes from a clean render, but leaves nothing for glare, ink spread, or a creased label. The app warns above 60% of the budget and flags 85% as having no margin left. The quiet zone around the logo insets the drawn image inside the already-blanked area, so it costs no additional modules.

## Do these codes expire?

No. The code is not a link to anything — your text is physically encoded in the pattern, so scanning it is decoding, not a lookup. There is no server, no account, and no record anywhere that could be switched off. The format is a frozen standard (ISO/IEC 18004), so readers will keep reading it.

This matters more than it sounds. Many free generators produce _dynamic_ codes that encode the vendor's own short domain and redirect to your URL. Those genuinely do die — the trial lapses, the company folds, the domain expires — and every code you printed breaks at once. A code from here has no middleman in it, including this project. If this repository disappeared, every code you have already exported would keep working.

What can still break is the **destination**. A code encoding `https://yoursite.com/promo` will deliver that URL faithfully forever, including long after the page 404s. For anything printed or long-lived, encode a URL on a domain you control and redirect from there, so you can change where it goes without reprinting. Plain text, phone numbers and WiFi credentials have nothing external to rot.

The other real failure mode is physical wear — fading, scuffs, creases, glare. Error correction is the margin that absorbs it, and a logo spends exactly that margin, which is why the logo control here is measured as a share of the budget. For print, prefer level H with a small logo or none, and keep the code large. Export the SVG and keep it: it is vector, so you can re-export at any size later without regenerating.

## Tech stack

| Concern   | Choice                     |
| --------- | -------------------------- |
| UI        | React 19                   |
| Build     | Vite 8                     |
| Language  | TypeScript (strict)        |
| Styling   | Tailwind CSS 4 (CSS-first) |
| QR render | qr-code-styling 1.9        |
| Typefaces | Inter, JetBrains Mono      |

## Local setup

Requires Node 20.19+ or 22.12+.

```bash
git clone https://github.com/avdyanov24/qr-forge.git
cd qr-forge
npm install
cp .env.example .env   # optional; the app needs no variables to run
npm run dev
```

The dev server prints a local URL. Other scripts:

```bash
npm run build         # typecheck and produce dist/
npm run typecheck     # types only
npm test              # unit tests
npm run lint          # oxlint
npm run format        # prettier, in place
npm run format:check  # prettier, report only
npm run preview       # serve the built output
```

## Deployment

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml`.

Pages serves the site from `/qr-forge/` rather than the domain root, so the workflow sets `VITE_BASE_PATH=/qr-forge/` at build time. Local development and any root-domain host need no configuration — `base` falls back to `/`. To deploy under a different path, set that variable to match.

## Project structure

```
qr-forge/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/ci.yml
├── src/
│   ├── components/
│   │   ├── Controls.tsx    # rail primitives: fields, selects, sliders, colour, logo
│   │   ├── Preview.tsx     # QRCodeStyling instance and its lifecycle
│   │   └── ScanRisk.tsx    # annunciator panel for risk findings
│   ├── lib/
│   │   ├── qr.ts           # options builder, risk model, export
│   │   ├── patterns.ts     # canvas-drawn background patterns
│   │   └── templates.ts    # print sizes, canvas render, print-risk model
│   ├── App.tsx             # layout and state
│   ├── index.css           # design tokens and component styles
│   └── main.tsx
├── index.html
├── tsconfig.json
└── vite.config.ts
```

State lives in a single `QrConfig` object in `App.tsx`. `src/lib/qr.ts` holds everything that is pure — building the render options, the risk model, and the export path — so it is testable without a DOM.

## Roadmap

- Unit tests for the risk model and export helpers
- Linting and formatting in CI
- Keyboard and screen-reader passes over the control rail
- Move rasterisation off the main thread so large exports do not block
- Batch generation from a pasted list

## License

MIT — see [LICENSE](LICENSE).
