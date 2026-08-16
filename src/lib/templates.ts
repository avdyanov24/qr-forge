import QRCodeStyling from "qr-code-styling";
import { buildOptions, type QrConfig, type RiskFinding } from "./qr";
import { drawCover, drawPattern, type PatternId } from "./patterns";

/** Print resolution. Anything less than 300 looks soft on paper. */
export const EXPORT_DPI = 300;
/** Enough to judge the layout on screen without paying for a print render. */
export const PREVIEW_DPI = 150;

const MM_PER_INCH = 25.4;

export const px = (mm: number, dpi: number) => Math.round((mm / MM_PER_INCH) * dpi);

export type TemplateId = "bookmark" | "card" | "flyer" | "sticker" | "poster";

export interface Template {
  id: TemplateId;
  label: string;
  /** Real trim size. These are the numbers a printer expects. */
  widthMm: number;
  heightMm: number;
  /** Code width in mm before the size control scales it. */
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
    qrMm: 32,
    padMm: 7,
    headlineMm: 4.4,
    subMm: 2.8,
  },
  {
    id: "sticker",
    label: "Sticker · 60 × 60 mm",
    widthMm: 60,
    heightMm: 60,
    qrMm: 32,
    padMm: 7,
    headlineMm: 4.6,
    subMm: 3,
  },
  {
    id: "flyer",
    label: "Flyer A6 · 105 × 148 mm",
    widthMm: 105,
    heightMm: 148,
    qrMm: 58,
    padMm: 12,
    headlineMm: 7,
    subMm: 4,
  },
  {
    id: "poster",
    label: "Poster A5 · 148 × 210 mm",
    widthMm: 148,
    heightMm: 210,
    qrMm: 78,
    padMm: 16,
    headlineMm: 9.5,
    subMm: 5,
  },
];

export type Composition = "qr-top" | "qr-bottom" | "qr-left" | "qr-right";
export type Align = "left" | "center" | "right";

export const COMPOSITIONS: { value: Composition; label: string }[] = [
  { value: "qr-top", label: "Code above text" },
  { value: "qr-bottom", label: "Code below text" },
  { value: "qr-left", label: "Code left of text" },
  { value: "qr-right", label: "Code right of text" },
];

export const ALIGNMENTS: Align[] = ["left", "center", "right"];

export interface LayoutConfig {
  template: TemplateId;
  background: string;
  ink: string;
  headline: string;
  sub: string;
  composition: Composition;
  align: Align;
  /** Multiplies the template's own code width. */
  qrScale: number;
  pattern: PatternId;
  patternColor: string;
  patternScale: number;
  patternOpacity: number;
  /** Used when the pattern is "image". */
  backgroundImage: string | null;
  logo: string | null;
  /** Logo width as a fraction of the piece's width. */
  logoScale: number;
  cornerRadiusMm: number;
  keyline: boolean;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  template: "bookmark",
  background: "#E8E6E1",
  ink: "#08080A",
  headline: "Scan me",
  sub: "example.com",
  composition: "qr-top",
  align: "center",
  qrScale: 1,
  pattern: "none",
  patternColor: "#C8A24A",
  patternScale: 1,
  patternOpacity: 0.5,
  backgroundImage: null,
  logo: null,
  logoScale: 0.3,
  cornerRadiusMm: 0,
  keyline: false,
};

export function templateById(id: TemplateId): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Code width in mm after the size control is applied. */
export function qrWidthMm(layout: LayoutConfig, template: Template): number {
  return template.qrMm * layout.qrScale;
}

/* ---------------------------------------------------------------------- */
/* Render                                                                 */
/* ---------------------------------------------------------------------- */

/**
 * Exported for tests. Only depends on the context for `measureText`, so it
 * can be exercised with a stub instead of a real canvas.
 */
export function wrap(
  ctx: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = "";
  let dropped = false;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    // A single word wider than the column still has to go somewhere.
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) {
      // This word and everything after it has nowhere to go.
      dropped = true;
      line = "";
      break;
    }
  }
  if (line) lines.push(line);
  if (lines.length === 0) return lines;

  const last = lines.length - 1;
  const overflows = ctx.measureText(lines[last]).width > maxWidth;

  // Mark the cut whenever text was lost — either words that never fit, or a
  // final line running past the trim edge. Without this the copy is silently
  // shortened and reads as if it all landed.
  if (dropped || overflows) {
    let tail = lines[last];
    while (tail.length > 1 && ctx.measureText(`${tail}…`).width > maxWidth) {
      tail = tail.slice(0, -1);
    }
    lines[last] = `${tail}…`;
  }
  return lines;
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Could not load the image.")), {
      once: true,
    });
    image.src = src;
  });
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

  // Anything outside the corner radius stays transparent — that is where the
  // die cut would fall, so it should not print as background colour.
  const radius = px(layout.cornerRadiusMm, dpi);
  ctx.save();
  roundedPath(ctx, 0, 0, widthPx, heightPx, radius);
  ctx.clip();

  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (layout.pattern === "image" && layout.backgroundImage) {
    const image = await loadImage(layout.backgroundImage);
    ctx.globalAlpha = layout.patternOpacity;
    drawCover(ctx, image, widthPx, heightPx, image.naturalWidth, image.naturalHeight);
    ctx.globalAlpha = 1;
  } else if (layout.pattern !== "none" && layout.pattern !== "image") {
    ctx.globalAlpha = layout.patternOpacity;
    drawPattern(ctx, layout.pattern, widthPx, heightPx, layout.patternColor, layout.patternScale);
    ctx.globalAlpha = 1;
  }

  // Render the code at its final pixel size so it is never upscaled.
  const qrPx = px(qrWidthMm(layout, template), dpi);
  const instance = new QRCodeStyling(buildOptions(config, qrPx));
  const qrBlob = (await instance.getRawData("png")) as Blob | null;
  if (!qrBlob) throw new Error("Could not render the code.");
  const qrImage = await createImageBitmap(qrBlob);

  // The module count comes from the encoder that just ran, so it reflects the
  // data and level actually used rather than an estimate. The library exposes
  // no public accessor for it, and the alternative is reimplementing the
  // version capacity tables, so this reaches for the private field and falls
  // back to null — the print warning is skipped rather than guessed at.
  // oxlint-disable-next-line no-underscore-dangle
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

  const logoImage = layout.logo ? await loadImage(layout.logo) : null;
  const logoW = logoImage ? px(template.widthMm * layout.logoScale, dpi) : 0;
  const logoH = logoImage ? (logoW * logoImage.naturalHeight) / logoImage.naturalWidth : 0;

  ctx.textBaseline = "top";
  ctx.fillStyle = layout.ink;

  const horizontal = layout.composition === "qr-left" || layout.composition === "qr-right";

  // Anchor for aligned text and images within a column.
  const anchor = (left: number, width: number) =>
    layout.align === "left" ? left : layout.align === "right" ? left + width : left + width / 2;

  const placeX = (left: number, width: number, itemWidth: number) =>
    layout.align === "left"
      ? left
      : layout.align === "right"
        ? left + width - itemWidth
        : left + (width - itemWidth) / 2;

  const drawText = (left: number, width: number, top: number) => {
    let y = top;
    ctx.textAlign = layout.align === "center" ? "center" : layout.align;
    const x = anchor(left, width);

    ctx.font = headlineFont;
    for (const line of wrap(ctx, layout.headline, width, 2)) {
      ctx.fillText(line, x, y);
      y += headlineSize * 1.2;
    }
    const subLines = wrap(ctx, layout.sub, width, horizontal ? 3 : 2);
    if (subLines.length) {
      y += gap * 0.6;
      ctx.font = subFont;
      for (const line of subLines) {
        ctx.fillText(line, x, y);
        y += subSize * 1.4;
      }
    }
    return y - top;
  };

  const textHeight = (left: number, width: number) => {
    ctx.font = headlineFont;
    const headlineLines = wrap(ctx, layout.headline, width, 2).length;
    ctx.font = subFont;
    const subLines = wrap(ctx, layout.sub, width, horizontal ? 3 : 2).length;
    void left;
    return (
      headlineLines * headlineSize * 1.2 + (subLines ? gap * 0.6 + subLines * subSize * 1.4 : 0)
    );
  };

  if (!horizontal) {
    const left = pad;
    const width = widthPx - pad * 2;
    const textH = textHeight(left, width);
    const logoBlock = logoImage ? logoH + gap : 0;
    const codeFirst = layout.composition === "qr-top";

    const total = logoBlock + qrPx + (textH ? gap * 1.2 + textH : 0);
    let y = Math.round((heightPx - total) / 2);

    if (logoImage) {
      ctx.drawImage(logoImage, placeX(left, width, logoW), y, logoW, logoH);
      y += logoH + gap;
    }
    if (codeFirst) {
      ctx.drawImage(qrImage, placeX(left, width, qrPx), y, qrPx, qrPx);
      y += qrPx;
      if (textH) drawText(left, width, y + gap * 1.2);
    } else {
      if (textH) {
        drawText(left, width, y);
        y += textH + gap * 1.2;
      }
      ctx.drawImage(qrImage, placeX(left, width, qrPx), y, qrPx, qrPx);
    }
  } else {
    const codeLeft = layout.composition === "qr-left";
    const columnGap = gap * 1.2;
    const textWidth = widthPx - qrPx - columnGap - pad * 2;
    const qrX = codeLeft ? pad : widthPx - pad - qrPx;
    const textLeft = codeLeft ? pad + qrPx + columnGap : pad;

    ctx.drawImage(qrImage, qrX, Math.round((heightPx - qrPx) / 2), qrPx, qrPx);

    const textH = textHeight(textLeft, textWidth);
    const logoBlock = logoImage ? logoH + gap : 0;
    let y = Math.round((heightPx - (textH + logoBlock)) / 2);

    if (logoImage) {
      ctx.drawImage(logoImage, placeX(textLeft, textWidth, logoW), y, logoW, logoH);
      y += logoH + gap;
    }
    if (textH) drawText(textLeft, textWidth, y);
  }

  if (layout.keyline) {
    const inset = Math.round(pad * 0.45);
    ctx.strokeStyle = layout.ink;
    ctx.lineWidth = Math.max(1, px(0.35, dpi));
    roundedPath(
      ctx,
      inset,
      inset,
      widthPx - inset * 2,
      heightPx - inset * 2,
      Math.max(0, radius - inset),
    );
    ctx.stroke();
  }

  ctx.restore();

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
  layout?: LayoutConfig,
): number | null {
  if (!moduleCount) return null;
  const widthMm = layout ? qrWidthMm(layout, template) : template.qrMm;
  return (widthMm * (1 - 2 * config.margin)) / moduleCount;
}

export function analyzePrintRisk(
  config: QrConfig,
  layout: LayoutConfig,
  moduleCount: number | null,
): RiskFinding[] {
  const template = templateById(layout.template);
  const findings: RiskFinding[] = [];

  const module = moduleSizeMm(config, template, moduleCount, layout);
  if (module !== null) {
    const mm = module.toFixed(2);
    if (module < 0.3) {
      findings.push({
        level: "critical",
        title: "Modules too small to print",
        detail: `Each module lands at ${mm} mm on a ${template.widthMm} × ${template.heightMm} mm piece. Phone cameras stop resolving modules below roughly 0.4 mm, and ink spread closes the gap further. Enlarge the code, shorten the encoded text, or raise the error correction level.`,
      });
    } else if (module < 0.4) {
      findings.push({
        level: "marginal",
        title: "Modules near the print limit",
        detail: `Each module lands at ${mm} mm. That reads on a good camera in good light, but leaves nothing for ink spread, cheap paper, or an awkward angle. Around 0.5 mm is a comfortable floor.`,
      });
    }
  }

  // The code is drawn as an opaque image carrying its own background, so it
  // always punches a clean rectangle through whatever is underneath. That is
  // what keeps the quiet zone intact over a pattern — the only cost is that
  // the rectangle is visible when the two backgrounds differ.
  if (layout.background.toLowerCase() !== config.background.toLowerCase()) {
    findings.push({
      level: "marginal",
      title: "Code prints as a visible tile",
      detail:
        layout.pattern !== "none"
          ? "The code carries its own background colour, so it prints as a solid rectangle interrupting the pattern. That is what protects the quiet zone a reader needs — match the code's background to the piece if you would rather it sat flush."
          : "The piece's background and the code's own background are different colours, so the code will print as a visible tile rather than sitting flush. Match them if you want the code to blend into the piece.",
    });
  }

  return findings;
}
