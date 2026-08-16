import type { QrConfig } from "./qr";
import type { LayoutConfig } from "./templates";

/**
 * Ready-made designs, covering the code and the piece it sits on.
 *
 * Two rules hold these together. A preset never touches content — the text,
 * the logo, the headline and the chosen template all survive, because those
 * are the user's, not the design's. And every preset has to pass the app's own
 * scan-risk checks with nothing flagged; a preset that looks good and fails to
 * scan would undercut the point of the rest of the tool.
 *
 * The two backgrounds are kept equal on purpose. Where they differ the code
 * prints as a visible tile, which the risk model reports — a preset should not
 * ship with a warning built into it.
 */
export interface Preset {
  id: string;
  name: string;
  /** Shown under the grid, including any error-correction change. */
  note: string;
  /** Appearance of the code. Never data or logo. */
  code: Partial<QrConfig>;
  /** Appearance of the piece. Never template, copy, logo or image. */
  piece: Partial<LayoutConfig>;
}

export const PRESETS: Preset[] = [
  {
    id: "sharp",
    name: "Sharp",
    note: "Square modules, black on white. The baseline to come back to. Level Q.",
    code: {
      foreground: "#08080A",
      background: "#FFFFFF",
      gradient: null,
      cornerColor: null,
      dotStyle: "square",
      cornerStyle: "square",
      cornerDotStyle: "square",
      shape: "square",
      margin: 0.1,
      ecc: "Q",
    },
    piece: {
      background: "#FFFFFF",
      ink: "#08080A",
      pattern: "none",
      composition: "qr-top",
      align: "center",
      qrRadiusMm: 0,
      cornerRadiusMm: 0,
      keyline: false,
    },
  },
  {
    id: "soft",
    name: "Soft",
    note: "Rounded modules on warm paper, with rounded corners on the piece. Level Q.",
    code: {
      foreground: "#101114",
      background: "#F7F6F3",
      gradient: null,
      cornerColor: null,
      dotStyle: "extra-rounded",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "dot",
      shape: "square",
      margin: 0.1,
      ecc: "Q",
    },
    piece: {
      background: "#F7F6F3",
      ink: "#14161A",
      pattern: "none",
      composition: "qr-top",
      align: "center",
      qrRadiusMm: 4,
      cornerRadiusMm: 4,
      keyline: false,
    },
  },
  {
    id: "brass",
    name: "Brass",
    note: "Modules fading into brass, over a wave band. Level Q to carry the gradient.",
    code: {
      foreground: "#08080A",
      background: "#FFFFFF",
      gradient: { type: "linear", color: "#8F7229", rotation: 45 },
      cornerColor: null,
      dotStyle: "rounded",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "dot",
      shape: "square",
      margin: 0.1,
      ecc: "Q",
    },
    piece: {
      background: "#FFFFFF",
      ink: "#1A1408",
      pattern: "waves",
      patternPlacement: "bottom",
      patternColor: "#C8A24A",
      patternScale: 1,
      patternOpacity: 0.55,
      composition: "qr-top",
      align: "center",
      qrRadiusMm: 3,
      cornerRadiusMm: 0,
      keyline: false,
    },
  },
  {
    id: "ink",
    name: "Ink",
    note: "Dot modules with a wide quiet zone, code beside the text. Level Q.",
    code: {
      foreground: "#12161F",
      background: "#FFFFFF",
      gradient: null,
      cornerColor: null,
      dotStyle: "dots",
      cornerStyle: "square",
      cornerDotStyle: "square",
      shape: "square",
      margin: 0.12,
      ecc: "Q",
    },
    piece: {
      background: "#FFFFFF",
      ink: "#12161F",
      pattern: "contours",
      patternPlacement: "full",
      patternColor: "#12161F",
      patternScale: 1.2,
      patternOpacity: 0.12,
      composition: "qr-left",
      align: "left",
      qrRadiusMm: 0,
      cornerRadiusMm: 0,
      keyline: false,
    },
  },
  {
    id: "orbit",
    name: "Orbit",
    note: "Circular frame with rounded modules. Few readers see this one. Level Q.",
    code: {
      foreground: "#08080A",
      background: "#FFFFFF",
      gradient: null,
      cornerColor: null,
      dotStyle: "rounded",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "dot",
      shape: "circle",
      margin: 0.1,
      ecc: "Q",
    },
    piece: {
      background: "#FFFFFF",
      ink: "#08080A",
      pattern: "arc",
      patternPlacement: "full",
      patternColor: "#C8A24A",
      patternScale: 1,
      patternOpacity: 0.22,
      composition: "qr-top",
      align: "center",
      qrRadiusMm: 0,
      cornerRadiusMm: 0,
      keyline: false,
    },
  },
  {
    id: "print-safe",
    name: "Print safe",
    note: "Maximum contrast, widest quiet zone, level H. Built to survive the stress test.",
    code: {
      foreground: "#000000",
      background: "#FFFFFF",
      gradient: null,
      cornerColor: null,
      dotStyle: "square",
      cornerStyle: "square",
      cornerDotStyle: "square",
      shape: "square",
      margin: 0.14,
      ecc: "H",
    },
    piece: {
      background: "#FFFFFF",
      ink: "#000000",
      pattern: "none",
      composition: "qr-top",
      align: "center",
      qrRadiusMm: 0,
      cornerRadiusMm: 0,
      keyline: true,
    },
  },
];

/** Short fixed payload for the grid thumbnails, so they render once. */
export const PRESET_SAMPLE = "https://qr.example";

/*
  Applied one slice at a time so each can go through a functional state update.
  Taking both at once invited a stale closure: a preset applied moments after
  typing rebuilt the config from a snapshot that predated the debounced text,
  which put the old string back into the code while the input still showed the
  new one — the code and the field disagreeing, silently.
*/
export function applyPresetToCode(preset: Preset, config: QrConfig): QrConfig {
  // Spread order matters: the preset overrides appearance, and everything it
  // does not mention — data, logo — is carried through.
  return { ...config, ...preset.code };
}

export function applyPresetToPiece(preset: Preset, layout: LayoutConfig): LayoutConfig {
  return { ...layout, ...preset.piece };
}

export function applyPreset(
  preset: Preset,
  config: QrConfig,
  layout: LayoutConfig,
): { config: QrConfig; layout: LayoutConfig } {
  return {
    config: applyPresetToCode(preset, config),
    layout: applyPresetToPiece(preset, layout),
  };
}
