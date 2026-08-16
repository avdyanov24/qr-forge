/**
 * Background patterns for printable pieces. Every one is drawn from scratch
 * on the canvas so it stays sharp at 300 dpi — nothing here is a bitmap that
 * would soften when the piece is exported at print resolution.
 *
 * Each takes the full piece in pixels plus a scale factor, and paints in the
 * current fillStyle. Opacity is applied by the caller.
 */

export type PatternId =
  "none" | "waves" | "stripes" | "dots" | "grid" | "gradient" | "arc" | "image";

export const PATTERNS: { value: PatternId; label: string }[] = [
  { value: "none", label: "None" },
  { value: "waves", label: "Waves" },
  { value: "stripes", label: "Stripes" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "gradient", label: "Gradient" },
  { value: "arc", label: "Arc" },
  { value: "image", label: "Image" },
];

/** Reference unit so patterns keep their proportions on any piece size. */
const unit = (width: number, height: number) => Math.min(width, height);

function waves(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const base = unit(w, h);
  const amplitude = base * 0.07 * scale;
  const wavelength = base * 0.9 * scale;

  // Three layers, each lower and slightly more opaque, so the crests read as
  // depth rather than as one flat silhouette.
  for (let layer = 0; layer < 3; layer++) {
    const top = h * (0.62 + layer * 0.12);
    const phase = layer * wavelength * 0.35;
    ctx.globalAlpha = 0.35 + layer * 0.32;

    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, top);
    for (let x = 0; x <= w; x += 2) {
      ctx.lineTo(x, top + Math.sin(((x + phase) / wavelength) * Math.PI * 2) * amplitude);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function stripes(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const width = unit(w, h) * 0.05 * scale;
  const gap = width * 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  // Diagonal, so start well left of the piece to cover the corner.
  for (let x = -h; x < w + h; x += width + gap) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.lineTo(x + h + width, 0);
    ctx.lineTo(x + width, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function dots(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const step = unit(w, h) * 0.075 * scale;
  const radius = step * 0.16;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function grid(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const step = unit(w, h) * 0.075 * scale;
  const line = Math.max(1, unit(w, h) * 0.002);
  for (let x = step; x < w; x += step) ctx.fillRect(x, 0, line, h);
  for (let y = step; y < h; y += step) ctx.fillRect(0, y, w, line);
}

function arc(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const radius = unit(w, h) * 0.85 * scale;
  ctx.beginPath();
  ctx.arc(0, h, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(w, 0, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function gradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
  color: string,
) {
  const fill = ctx.createLinearGradient(0, 0, w * 0.35, h);
  fill.addColorStop(0, color);
  // Fading to transparent keeps the piece's own background colour showing
  // through rather than muddying it with a second opaque wash.
  fill.addColorStop(Math.min(1, 0.85 * scale), "transparent");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
}

/** Cover-fit, the way a CSS background-size: cover would place it. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  w: number,
  h: number,
  sourceW: number,
  sourceH: number,
) {
  const ratio = Math.max(w / sourceW, h / sourceH);
  const drawW = sourceW * ratio;
  const drawH = sourceH * ratio;
  ctx.drawImage(image, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
}

export function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: PatternId,
  w: number,
  h: number,
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.fillStyle = color;

  switch (pattern) {
    case "waves":
      waves(ctx, w, h, scale);
      break;
    case "stripes":
      stripes(ctx, w, h, scale);
      break;
    case "dots":
      dots(ctx, w, h, scale);
      break;
    case "grid":
      grid(ctx, w, h, scale);
      break;
    case "gradient":
      gradient(ctx, w, h, scale, color);
      break;
    case "arc":
      arc(ctx, w, h, scale);
      break;
    default:
      break;
  }

  ctx.restore();
}
