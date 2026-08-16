import QRCodeStyling from "qr-code-styling";
import type {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  FileExtension,
  GradientType,
  Options,
  ShapeType,
} from "qr-code-styling/lib/types";

export type {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  FileExtension,
  GradientType,
  ShapeType,
};

/**
 * PNG leads because it is the format most things accept. SVG stays sharp at
 * any size. JPEG and WebP are there for size-constrained uploads — neither
 * carries transparency, which costs nothing here since the background is
 * always painted.
 */
export const EXPORT_FORMATS: { value: FileExtension; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export const DOT_STYLES: { value: DotType; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "dots", label: "Dots" },
  { value: "rounded", label: "Rounded" },
  { value: "extra-rounded", label: "Extra rounded" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy rounded" },
];

export const CORNER_STYLES: { value: CornerSquareType; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "dot", label: "Dot" },
  { value: "extra-rounded", label: "Rounded" },
];

export const CORNER_DOT_STYLES: { value: CornerDotType; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "dot", label: "Dot" },
  { value: "extra-rounded", label: "Rounded" },
];

export const SHAPES: { value: ShapeType; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
];

export const GRADIENT_TYPES: { value: GradientType | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
];

/**
 * Quiet zone around the code, as a fraction of its width. The specification
 * asks for four blank modules on every side, which lands near 10% for a
 * typical code — hence the default. Below this the code still renders, it
 * just gets harder for a reader to find against a busy background.
 */
export const MARGIN_MIN = 0;
export const MARGIN_MAX = 0.16;
export const MARGIN_STEP = 0.01;
const MARGIN_SPEC_FLOOR = 0.06;

export const ECC_LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

export const SIZE_MIN = 256;
export const SIZE_MAX = 2048;
export const SIZE_STEP = 64;
export const SIZE_DEFAULT = 1024;

/**
 * Output size is deliberately not part of QrConfig. It only affects the
 * exported file — the preview renders at a fixed internal size — so keeping
 * it out means dragging the size slider cannot invalidate the render.
 */

/** Size the preview renders at. Output size is independent of this. */
export const PREVIEW_SIZE = 640;

export interface QrConfig {
  data: string;
  foreground: string;
  background: string;
  /** Second stop of the module gradient. Null renders a flat foreground. */
  gradient: { type: GradientType; color: string; rotation: number } | null;
  /** Overrides the foreground on the three finder patterns. Null matches it. */
  cornerColor: string | null;
  dotStyle: DotType;
  cornerStyle: CornerSquareType;
  cornerDotStyle: CornerDotType;
  shape: ShapeType;
  /** Quiet zone around the code, as a fraction of its width. */
  margin: number;
  ecc: ErrorCorrectionLevel;
  logo: string | null;
  /** Share of the error-correction budget the logo is allowed to consume. */
  logoScale: number;
}

export const DEFAULT_CONFIG: QrConfig = {
  data: "https://example.com",
  foreground: "#08080A",
  background: "#E8E6E1",
  gradient: null,
  cornerColor: null,
  dotStyle: "square",
  cornerStyle: "square",
  cornerDotStyle: "square",
  shape: "square",
  margin: 0.1,
  ecc: "Q",
  logo: null,
  logoScale: 0.4,
};

/**
 * Quiet zone around the logo, as a fraction of the code's width. This insets
 * the drawn image inside the blanked area — it costs no extra modules.
 */
export const LOGO_QUIET_ZONE = 0.02;

export function buildOptions(config: QrConfig, size: number): Options {
  // The library takes gradient rotation in radians; the UI works in degrees.
  const gradient = config.gradient
    ? {
        type: config.gradient.type,
        rotation:
          config.gradient.type === "linear" ? (config.gradient.rotation * Math.PI) / 180 : 0,
        colorStops: [
          { offset: 0, color: config.foreground },
          { offset: 1, color: config.gradient.color },
        ],
      }
    : undefined;

  // A custom corner colour is a flat override, so it drops the gradient on the
  // finder patterns rather than blending two different fills.
  const corners = config.cornerColor
    ? { color: config.cornerColor }
    : { color: config.foreground, gradient };

  return {
    type: "svg",
    shape: config.shape,
    width: size,
    height: size,
    margin: Math.round(size * config.margin),
    data: config.data,
    image: config.logo ?? undefined,
    qrOptions: { errorCorrectionLevel: config.ecc },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: config.logoScale,
      margin: Math.round(size * LOGO_QUIET_ZONE),
      crossOrigin: "anonymous",
    },
    dotsOptions: { type: config.dotStyle, color: config.foreground, gradient },
    cornersSquareOptions: { type: config.cornerStyle, ...corners },
    cornersDotOptions: { type: config.cornerDotStyle, ...corners },
    backgroundOptions: { color: config.background },
  };
}

/* ---------------------------------------------------------------------- */
/* Scan risk                                                              */
/* ---------------------------------------------------------------------- */

/**
 * Share of codewords each level can lose and still decode.
 *
 * qr-code-styling sizes the logo *against* this table: it blanks at most
 * `logoScale * ECC_BUDGET[level] * modules²` dots. So logoScale is the share
 * of the recovery budget the logo eats, not a share of the code's width, and
 * the logo can never mathematically exceed what the level can recover. The
 * real failure mode is margin: a logo that spends the whole budget leaves
 * nothing for print noise, glare, or a creased label.
 */
const ECC_BUDGET: Record<ErrorCorrectionLevel, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
};

export type RiskLevel = "ok" | "marginal" | "critical";

export interface RiskFinding {
  level: Exclude<RiskLevel, "ok">;
  title: string;
  detail: string;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return 0;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Coverage {
  /** Share of the level's recovery budget the logo consumes. */
  budgetShare: number;
  /** Share of the code's modules the logo blanks outright. */
  moduleShare: number;
}

export function logoCoverage(config: QrConfig): Coverage {
  if (!config.logo) return { budgetShare: 0, moduleShare: 0 };
  return {
    budgetShare: config.logoScale,
    moduleShare: config.logoScale * ECC_BUDGET[config.ecc],
  };
}

export function analyzeRisk(config: QrConfig): RiskFinding[] {
  const findings: RiskFinding[] = [];

  if (config.logo) {
    const { budgetShare, moduleShare } = logoCoverage(config);
    const sharePct = Math.round(budgetShare * 100);
    const modulePct = Math.round(moduleShare * 100);

    if (budgetShare > 0.85) {
      findings.push({
        level: "critical",
        title: "No recovery margin left",
        detail: `The logo blanks ${modulePct}% of the modules, spending ${sharePct}% of what level ${config.ecc} can recover. On paper it still decodes; in practice any glare, ink spread, or crease pushes it past the limit. Shrink the logo or raise error correction.`,
      });
    } else if (budgetShare > 0.6) {
      findings.push({
        level: "marginal",
        title: "Logo near recovery limit",
        detail: `The logo spends ${sharePct}% of level ${config.ecc}'s recovery budget, blanking ${modulePct}% of the modules. It scans clean on screen, but leaves little headroom for print.`,
      });
    }
  }

  // A gradient stop or a custom corner colour can each fail on its own, and a
  // reader only needs one region to go muddy, so the weakest one governs.
  const inks: { label: string; color: string }[] = [
    { label: "Foreground", color: config.foreground },
    ...(config.gradient ? [{ label: "Gradient end", color: config.gradient.color }] : []),
    ...(config.cornerColor ? [{ label: "Corner colour", color: config.cornerColor }] : []),
  ];

  const weakest = inks.reduce(
    (worst, ink) => {
      const ratio = contrastRatio(ink.color, config.background);
      return ratio < worst.ratio ? { label: ink.label, ratio } : worst;
    },
    { label: "", ratio: Number.POSITIVE_INFINITY },
  );

  if (weakest.ratio < 3) {
    // Severity depends on which region goes faint. A flat foreground takes the
    // whole code with it. The finder patterns are worse than they look: a
    // reader uses them to locate the code at all, and they carry no error
    // correction, so when they fail there is nothing to recover from. A weak
    // gradient end only dims data modules, which error correction can absorb.
    const ratio = weakest.ratio.toFixed(1);
    const finding: Record<string, RiskFinding> = {
      Foreground: {
        level: "critical",
        title: "Insufficient contrast",
        detail: `Foreground and background differ by ${ratio}:1. Readers need roughly 3:1 to separate modules from the field.`,
      },
      "Corner colour": {
        level: "critical",
        title: "Finder patterns too faint",
        detail: `The corner colour sits at ${ratio}:1 against the background. Readers use those three squares to locate the code before decoding it, and they carry no error correction — when they wash out, the code is not found at all rather than partly recovered.`,
      },
      "Gradient end": {
        level: "marginal",
        title: "Gradient end is faint",
        detail: `The gradient ends at ${ratio}:1 against the background, under the 3:1 readers want. Only the modules at that end are affected and error correction can usually absorb them, but it is the first thing to fail in print or at an angle.`,
      },
    };
    findings.push(finding[weakest.label]);
  }

  if (config.margin < MARGIN_SPEC_FLOOR) {
    findings.push({
      level: "marginal",
      title: "Quiet zone below specification",
      detail:
        "The format asks for four blank modules on every side so a reader can find the code's edges. This one is narrower. It will scan against a plain field, but risks failing on a busy background or against the edge of a printed page.",
    });
  }

  if (luminance(config.foreground) > luminance(config.background)) {
    findings.push({
      level: "marginal",
      title: "Inverted polarity",
      detail:
        "The modules are lighter than the background. The spec assumes dark on light, and a number of older readers will not invert.",
    });
  }

  return findings;
}

/* ---------------------------------------------------------------------- */
/* Export                                                                 */
/* ---------------------------------------------------------------------- */

/** Exported for tests: the slug is easy to break and hard to notice. */
export function filename(data: string, extension: FileExtension): string {
  const slug = data
    .replace(/^https?:\/\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `qr-${slug || "code"}.${extension}`;
}

/**
 * The encoder throws synchronously and its messages are written for whoever
 * wrote the library. Translate them into something that names the fix.
 */
export function describeEncodeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/overflow/i.test(message)) {
    return "Too much data for this error correction level. Shorten the text, or drop to a lower level — capacity falls as error correction rises.";
  }
  if (/no input|empty/i.test(message)) {
    return "Nothing to encode yet.";
  }
  return "This content could not be encoded as a QR code.";
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportCode(
  config: QrConfig,
  size: number,
  extension: FileExtension,
): Promise<void> {
  const instance = new QRCodeStyling(buildOptions(config, size));
  const blob = (await instance.getRawData(extension)) as Blob | null;
  if (!blob) throw new Error("Could not render the code for export.");

  downloadBlob(blob, filename(config.data, extension));
}
