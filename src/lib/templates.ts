import QRCodeStyling from "qr-code-styling";
import { buildOptions, type QrConfig, type RiskFinding } from "./qr";

/** Print resolution. Anything less than 300 looks soft on paper. */
export const EXPORT_DPI = 300;
/** Enough to judge the layout on screen without paying for a print render. */
export const PREVIEW_DPI = 150;

const MM_PER_INCH = 25.4;

export const px = (mm: number, dpi: number) => Math.round((mm / MM_PER_INCH) * dpi);

export type TemplateId = "bookmark" | "card" | "flyer";

export interface Template {
  id: TemplateId;
  label: string;
  /** Real trim size. These are the numbers a printer expects. */
  widthMm: number;
  heightMm: number;
  /** Stacked puts the code above the text; side sets them left and right. */
  arrangement: "stacked" | "side";
  qrMm: number;
  padMm: number;
  headlineMm: number;
  subMm: number;
}

export const TEMPLATES: Template[] = [
  {
    id: "bookmark",
    label: "Bookmark · 50 × 150 mm",
    widthMm: 50,
    heightMm: 150,
    arrangement: "stacked",
    qrMm: 34,
    padMm: 8,
    headlineMm: 5,
    subMm: 3,
  },
  {
    id: "card",
    label: "Business card · 85 × 55 mm",
    widthMm: 85,
    heightMm: 55,
    arrangement: "side",
    qrMm: 32,
    padMm: 7,
    headlineMm: 4.4,
    subMm: 2.8,
  },
  {
    id: "flyer",
    label: "Flyer A6 · 105 × 148 mm",
    widthMm: 105,
    heightMm: 148,
    arrangement: "stacked",
    qrMm: 58,
    padMm: 12,
    headlineMm: 7,
    subMm: 4,
  },
];

export interface LayoutConfig {
  template: TemplateId;
  background: string;
  ink: string;
  headline: string;
  sub: string;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  template: "bookmark",
  background: "#E8E6E1",
  ink: "#08080A",
  headline: "Scan me",
  sub: "example.com",
};

export function templateById(id: TemplateId): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/* ---------------------------------------------------------------------- */
/* Render                                                                 */
/* ---------------------------------------------------------------------- */

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  // Trim the last line rather than letting it run past the trim edge.
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

export interface RenderResult {
  blob: Blob;
  /** Modules across the code, needed to judge physical module size. */
  moduleCount: number | null;
  widthPx: number;
  heightPx: number;
}

/**
 * Draws the whole piece at a given resolution. Preview and export both go
 * through here so what is on screen is what lands on paper.
 */
export async function renderTemplate(
  config: QrConfig,
  layout: LayoutConfig,
  dpi: number,
): Promise<RenderResult> {
  const template = templateById(layout.template);
  const widthPx = px(template.widthMm, dpi);
  const heightPx = px(template.heightMm, dpi);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Render the code at its final pixel size so it is never upscaled.
  const qrPx = px(template.qrMm, dpi);
  const instance = new QRCodeStyling(buildOptions(config, qrPx));
  const qrBlob = (await instance.getRawData("png")) as Blob | null;
  if (!qrBlob) throw new Error("Could not render the code.");
  const qrImage = await createImageBitmap(qrBlob);

  // The module count comes from the encoder that just ran, so it reflects the
  // data and level actually used rather than an estimate.
  const encoder = (instance as unknown as { _qr?: { getModuleCount(): number } })._qr;
  const moduleCount = encoder ? encoder.getModuleCount() : null;

  // Canvas silently falls back to a default face if the font is not ready.
  await document.fonts.ready;

  const pad = px(template.padMm, dpi);
  const headlineSize = px(template.headlineMm, dpi);
  const subSize = px(template.subMm, dpi);
  const gap = Math.round(headlineSize * 0.55);

  const headlineFont = `600 ${headlineSize}px "Inter Variable", system-ui, sans-serif`;
  const subFont = `${subSize}px "JetBrains Mono Variable", ui-monospace, monospace`;

  ctx.textBaseline = "top";
  ctx.fillStyle = layout.ink;

  if (template.arrangement === "stacked") {
    const textWidth = widthPx - pad * 2;
    ctx.font = headlineFont;
    const headlineLines = wrap(ctx, layout.headline, textWidth, 2);
    ctx.font = subFont;
    const subLines = wrap(ctx, layout.sub, textWidth, 2);

    const textHeight =
      headlineLines.length * headlineSize * 1.2 +
      (subLines.length ? gap + subLines.length * subSize * 1.4 : 0);
    const blockHeight = qrPx + (textHeight ? gap * 1.4 + textHeight : 0);
    let y = Math.round((heightPx - blockHeight) / 2);

    ctx.drawImage(qrImage, Math.round((widthPx - qrPx) / 2), y, qrPx, qrPx);
    y += qrPx + gap * 1.4;

    ctx.textAlign = "center";
    ctx.font = headlineFont;
    for (const line of headlineLines) {
      ctx.fillText(line, widthPx / 2, y);
      y += headlineSize * 1.2;
    }
    if (subLines.length) {
      y += gap;
      ctx.font = subFont;
      for (const line of subLines) {
        ctx.fillText(line, widthPx / 2, y);
        y += subSize * 1.4;
      }
    }
  } else {
    const qrY = Math.round((heightPx - qrPx) / 2);
    ctx.drawImage(qrImage, pad, qrY, qrPx, qrPx);

    const textLeft = pad + qrPx + gap;
    const textWidth = widthPx - textLeft - pad;
    ctx.font = headlineFont;
    const headlineLines = wrap(ctx, layout.headline, textWidth, 2);
    ctx.font = subFont;
    const subLines = wrap(ctx, layout.sub, textWidth, 3);

    const textHeight =
      headlineLines.length * headlineSize * 1.2 +
      (subLines.length ? gap + subLines.length * subSize * 1.4 : 0);
    let y = Math.round((heightPx - textHeight) / 2);

    ctx.textAlign = "left";
    ctx.font = headlineFont;
    for (const line of headlineLines) {
      ctx.fillText(line, textLeft, y);
      y += headlineSize * 1.2;
    }
    if (subLines.length) {
      y += gap;
      ctx.font = subFont;
      for (const line of subLines) {
        ctx.fillText(line, textLeft, y);
        y += subSize * 1.4;
      }
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the layout.");
  return { blob, moduleCount, widthPx, heightPx };
}

/* ---------------------------------------------------------------------- */
/* Print risk                                                             */
/* ---------------------------------------------------------------------- */

/**
 * Physical size of one module in millimetres. This is what decides whether a
 * printed code scans — a phone camera cannot resolve modules that are too
 * small, no matter how much error correction the code carries.
 */
export function moduleSizeMm(
  config: QrConfig,
  template: Template,
  moduleCount: number | null,
): number | null {
  if (!moduleCount) return null;
  const codeMm = template.qrMm * (1 - 2 * config.margin);
  return codeMm / moduleCount;
}

export function analyzePrintRisk(
  config: QrConfig,
  layout: LayoutConfig,
  moduleCount: number | null,
): RiskFinding[] {
  const template = templateById(layout.template);
  const findings: RiskFinding[] = [];

  const module = moduleSizeMm(config, template, moduleCount);
  if (module !== null) {
    const mm = module.toFixed(2);
    if (module < 0.3) {
      findings.push({
        level: "critical",
        title: "Modules too small to print",
        detail: `Each module lands at ${mm} mm on a ${template.widthMm} × ${template.heightMm} mm piece. Phone cameras stop resolving modules below roughly 0.4 mm, and ink spread closes the gap further. Shorten the encoded text or raise the error correction level to reduce the module count.`,
      });
    } else if (module < 0.4) {
      findings.push({
        level: "marginal",
        title: "Modules near the print limit",
        detail: `Each module lands at ${mm} mm. That reads on a good camera in good light, but leaves nothing for ink spread, cheap paper, or an awkward angle. Around 0.5 mm is a comfortable floor.`,
      });
    }
  }

  const contrast = layout.background.toLowerCase() !== config.background.toLowerCase();
  if (contrast) {
    findings.push({
      level: "marginal",
      title: "Code sits on a different background",
      detail:
        "The piece's background and the code's own background are different colours, so the code will print as a visible tile rather than sitting flush. Match them if you want the code to blend into the piece.",
    });
  }

  return findings;
}
