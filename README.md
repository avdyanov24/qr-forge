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
- Dot styles: square, dots, rounded, classy
- Corner styles: square, dot, rounded
- Error correction levels L / M / Q / H
- Centred logo upload with a quiet zone, sized against the error-correction budget
- Output size from 256px to 2048px
- PNG and SVG export at the selected size
- Scan-risk analysis: recovery-budget exhaustion, low contrast, inverted polarity

## How the logo budget works

This is the part worth knowing, because it is not how most tools present it.

`qr-code-styling` does not size a logo as a fraction of the code's width. It blanks at most:

```
maxHiddenDots = imageSize × eccPercent × modules²
```

where `eccPercent` is `{ L: 0.07, M: 0.15, Q: 0.25, H: 0.30 }`. So `imageSize` is the share of the *recovery budget* the logo consumes, and a logo can never mathematically exceed what the level can recover — at level L it is simply drawn smaller.

The real failure mode is therefore margin, not overflow. A logo that spends the entire budget still decodes from a clean render, but leaves nothing for glare, ink spread, or a creased label. The app warns above 60% of the budget and flags 85% as having no margin left. The quiet zone around the logo insets the drawn image inside the already-blanked area, so it costs no additional modules.

## Tech stack

| Concern    | Choice                          |
| ---------- | ------------------------------- |
| UI         | React 19                        |
| Build      | Vite 8                          |
| Language   | TypeScript (strict)             |
| Styling    | Tailwind CSS 4 (CSS-first)      |
| QR render  | qr-code-styling 1.9             |
| Typefaces  | Inter, JetBrains Mono           |

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
npm run build      # typecheck and produce dist/
npm run typecheck  # types only
npm run preview    # serve the built output
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
│   │   └── qr.ts           # options builder, risk model, export
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
- Responsive layout below the 280px rail plus preview breakpoint
- Additional export formats (JPEG, WebP)
- Batch generation from a pasted list

## License

MIT — see [LICENSE](LICENSE).
