import QRCodeStyling from "qr-code-styling";
import type {
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  FileExtension,
  Options,
} from "qr-code-styling/lib/types";

export type { CornerSquareType, DotType, ErrorCorrectionLevel };

export const DOT_STYLES: { value: DotType; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "dots", label: "Dots" },
  { value: "rounded", label: "Rounded" },
  { value: "classy", label: "Classy" },
];

export const CORNER_STYLES: { value: CornerSquareType; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "dot", label: "Dot" },
  { value: "extra-rounded", label: "Rounded" },
];

export const ECC_LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

export const SIZE_MIN = 256;
export const SIZE_MAX = 2048;
export const SIZE_STEP = 64;

/** Size the preview renders at. Output size is independent of this. */
export const PREVIEW_SIZE = 640;

export interface QrConfig {
  data: string;
  foreground: string;
  background: string;
  dotStyle: DotType;
  cornerStyle: CornerSquareType;
  ecc: ErrorCorrectionLevel;
  size: number;
  logo: string | null;
  /** Share of the error-correction budget the logo is allowed to consume. */
  logoScale: number;
}

export const DEFAULT_CONFIG: QrConfig = {
  data: "https://example.com",
  foreground: "#08080A",
  background: "#E8E6E1",
  dotStyle: "square",
  cornerStyle: "square",
  ecc: "Q",
  size: 1024,
  logo: null,
  logoScale: 0.4,
};

/**
 * Quiet zone around the logo, as a fraction of the code's width. This insets
 * the drawn image inside the blanked area — it costs no extra modules.
 */
export const LOGO_QUIET_ZONE = 0.02;

/** Margin around the whole code, as a fraction of its width. */
const CODE_MARGIN = 0.04;

export function buildOptions(config: QrConfig, size: number): Options {
  return {
    type: "svg",
    width: size,
    height: size,
    margin: Math.round(size * CODE_MARGIN),
    data: config.data,
    image: config.logo ?? undefined,
    qrOptions: { errorCorrectionLevel: config.ecc },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: config.logoScale,
      margin: Math.round(size * LOGO_QUIET_ZONE),
      crossOrigin: "anonymous",
    },
    dotsOptions: { type: config.dotStyle, color: config.foreground },
    cornersSquareOptions: { type: config.cornerStyle, color: config.foreground },
    cornersDotOptions: { color: config.foreground },
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

  const contrast = contrastRatio(config.foreground, config.background);
  if (contrast < 3) {
    findings.push({
      level: "critical",
      title: "Insufficient contrast",
      detail: `Foreground and background differ by ${contrast.toFixed(1)}:1. Readers need roughly 3:1 to separate modules from the field.`,
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

function filename(data: string, extension: FileExtension): string {
  const slug = data
    .replace(/^https?:\/\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `qr-${slug || "code"}.${extension}`;
}

export async function exportCode(config: QrConfig, extension: FileExtension): Promise<void> {
  const instance = new QRCodeStyling(buildOptions(config, config.size));
  const blob = (await instance.getRawData(extension)) as Blob | null;
  if (!blob) throw new Error("Could not render the code for export.");

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename(config.data, extension);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
