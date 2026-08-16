/**
 * Background patterns for printable pieces. Every one is drawn from scratch
 * on the canvas so it stays sharp at 300 dpi — nothing here is a bitmap that
 * would soften when the piece is exported at print resolution.
 *
 * Each takes the full piece in pixels plus a scale factor, and paints in the
 * current fillStyle. Opacity is applied by the caller.
 */

export type PatternId =
  | "none"
  | "waves"
  | "contours"
  | "stripes"
  | "hexagons"
  | "dots"
  | "halftone"
  | "scatter"
  | "grid"
  | "gradient"
  | "arc"
  | "image";

export const PATTERNS: { value: PatternId; label: string }[] = [
  { value: "none", label: "None" },
  { value: "waves", label: "Waves" },
  { value: "contours", label: "Contours" },
  { value: "stripes", label: "Stripes" },
  { value: "hexagons", label: "Hexagons" },
  { value: "dots", label: "Dots" },
  { value: "halftone", label: "Halftone" },
  { value: "scatter", label: "Scatter" },
  { value: "grid", label: "Grid" },
  { value: "gradient", label: "Gradient" },
  { value: "arc", label: "Arc" },
  { value: "image", label: "Image" },
];

/**
 * Where the pattern is allowed to sit. A band keeps it clear of the code
 * without having to fade the whole thing out.
 */
export type PatternPlacement = "full" | "top" | "bottom" | "left" | "right";

export const PLACEMENTS: { value: PatternPlacement; label: string }[] = [
  { value: "full", label: "Whole piece" },
  { value: "top", label: "Top band" },
  { value: "bottom", label: "Bottom band" },
  { value: "left", label: "Left band" },
  { value: "right", label: "Right band" },
];

/** Clip region for a placement, as a fraction of the piece. */
export function placementRect(
  placement: PatternPlacement,
  w: number,
  h: number,
): [number, number, number, number] {
  switch (placement) {
    case "top":
      return [0, 0, w, h * 0.38];
    case "bottom":
      return [0, h * 0.62, w, h * 0.38];
    case "left":
      return [0, 0, w * 0.38, h];
    case "right":
      return [w * 0.62, 0, w * 0.38, h];
    default:
      return [0, 0, w, h];
  }
}

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

/**
 * Stacked contour lines, the way a topographic map reads. Each line is the
 * same wave at a different phase and amplitude, so they drift apart and back
 * together instead of running parallel.
 */
function contours(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const base = unit(w, h);
  const spacing = base * 0.055 * scale;
  const wavelength = base * 1.1 * scale;
  const line = Math.max(1, base * 0.004);

  ctx.lineWidth = line;
  ctx.strokeStyle = ctx.fillStyle;

  for (let i = 0, y = -spacing; y < h + spacing * 2; i++, y += spacing) {
    const amplitude = base * 0.03 * (1 + Math.sin(i * 0.6) * 0.55);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const offset = Math.sin((x / wavelength) * Math.PI * 2 + i * 0.45) * amplitude;
      if (x === 0) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
}

function hexagons(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const radius = unit(w, h) * 0.05 * scale;
  const line = Math.max(1, unit(w, h) * 0.003);
  const stepX = radius * 1.5;
  const stepY = radius * Math.sqrt(3);

  ctx.lineWidth = line;
  ctx.strokeStyle = ctx.fillStyle;

  for (let col = 0, x = 0; x < w + radius; col++, x += stepX) {
    // Every other column drops half a step, which is what interlocks them.
    const offsetY = col % 2 === 0 ? 0 : stepY / 2;
    for (let y = offsetY; y < h + stepY; y += stepY) {
      ctx.beginPath();
      for (let corner = 0; corner < 6; corner++) {
        const angle = (Math.PI / 3) * corner;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (corner === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

/** Dots that grow across the piece, the way a printed halftone ramp does. */
function halftone(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const step = unit(w, h) * 0.06 * scale;
  const max = step * 0.46;
  for (let y = step / 2; y < h + step; y += step) {
    for (let x = step / 2; x < w + step; x += step) {
      // Ramp along the diagonal so the gradient reads on any aspect ratio.
      const t = (x / w) * 0.6 + (y / h) * 0.4;
      const radius = max * t;
      if (radius < 0.3) continue;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Loose confetti. Deterministic from a fixed seed so the same design exports
 * identically every time — a pattern that reshuffled on each render would
 * make the preview a liar.
 */
function scatter(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const base = unit(w, h);
  const count = Math.round(90 / scale);
  let seed = 20260816;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const x = random() * w;
    const y = random() * h;
    const size = base * (0.008 + random() * 0.022) * scale;
    const angle = random() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.45 + random() * 0.55;
    ctx.fillRect(-size / 2, -size / 6, size, size / 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
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
  placement: PatternPlacement = "full",
) {
  ctx.save();
  ctx.fillStyle = color;

  if (placement !== "full") {
    const [x, y, width, height] = placementRect(placement, w, h);
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
  }

  switch (pattern) {
    case "waves":
      waves(ctx, w, h, scale);
      break;
    case "contours":
      contours(ctx, w, h, scale);
      break;
    case "stripes":
      stripes(ctx, w, h, scale);
      break;
    case "hexagons":
      hexagons(ctx, w, h, scale);
      break;
    case "dots":
      dots(ctx, w, h, scale);
      break;
    case "halftone":
      halftone(ctx, w, h, scale);
      break;
    case "scatter":
      scatter(ctx, w, h, scale);
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
