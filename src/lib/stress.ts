/**
 * Stress test.
 *
 * Every other check in this app is a prediction: contrast maths, module size
 * arithmetic, error-correction budgets. This one is evidence. It takes the
 * code as designed, damages it the way the physical world does, and asks a
 * real barcode reader whether it still decodes.
 *
 * The point is not to simulate any particular camera. It is that "the numbers
 * look fine" and "a reader could actually read it" are different claims, and
 * only one of them is worth printing five hundred copies on.
 */

export interface StressCondition {
  id: string;
  label: string;
  /** What real situation this stands in for. */
  detail: string;
  /** Draws the damaged code onto a fresh canvas and returns it. */
  apply: (source: ImageBitmap) => HTMLCanvasElement;
}

export interface StressOutcome {
  id: string;
  label: string;
  detail: string;
  decoded: boolean;
}

export interface StressReport {
  supported: boolean;
  outcomes: StressOutcome[];
  passed: number;
  total: number;
}

const SIZE = 600;

function canvasOf(width: number, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Paint on white — a printed code is on paper, not on the page's dark field. */
function ground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
}

export const CONDITIONS: StressCondition[] = [
  {
    id: "clean",
    label: "Clean render",
    detail: "The code exactly as designed, at full size. If this fails, nothing else matters.",
    apply: (source) => {
      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      ctx.drawImage(source, 0, 0, SIZE, SIZE);
      return canvas;
    },
  },
  {
    id: "distance",
    label: "Read from across the room",
    detail:
      "Downscaled to roughly what a phone resolves when the code is small in frame. This is where a dense payload on a small piece gives out.",
    apply: (source) => {
      const small = 132;
      const canvas = canvasOf(small);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, small, small);
      ctx.drawImage(source, 0, 0, small, small);
      return canvas;
    },
  },
  {
    id: "blur",
    label: "Out of focus",
    detail: "A camera that has not settled, or a code read while moving.",
    apply: (source) => {
      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      ctx.filter = "blur(3px)";
      ctx.drawImage(source, 0, 0, SIZE, SIZE);
      return canvas;
    },
  },
  {
    id: "ink",
    label: "Ink spread",
    detail:
      "Cheap paper wicks ink and dark modules grow into their neighbours. Fine modules close up first.",
    apply: (source) => {
      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      // Blur then crush the midtones: thin light gaps get swallowed by the
      // dark, which is what spreading ink does to a printed grid.
      ctx.filter = "blur(2px) contrast(6)";
      ctx.drawImage(source, 0, 0, SIZE, SIZE);
      return canvas;
    },
  },
  {
    id: "glare",
    label: "Glare and low light",
    detail: "A laminated card under a light, or a screen photographed at an angle.",
    apply: (source) => {
      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      ctx.filter = "contrast(0.4) brightness(1.25)";
      ctx.drawImage(source, 0, 0, SIZE, SIZE);
      return canvas;
    },
  },
  {
    id: "angle",
    label: "Held at an angle",
    detail: "Nobody lines a camera up square. Rotation plus a little perspective squeeze.",
    apply: (source) => {
      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.rotate((14 * Math.PI) / 180);
      ctx.scale(1, 0.88);
      ctx.drawImage(source, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
      return canvas;
    },
  },
  {
    id: "damage",
    label: "Scuffed or covered",
    detail:
      "A thumb over the corner, a crease, a sticker rubbed on a bag. This is what the error-correction budget is actually for.",
    apply: (source) => {
      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      ctx.drawImage(source, 0, 0, SIZE, SIZE);
      // Roughly 6% of the area, off-centre, away from the finder patterns so
      // this tests recovery rather than detection.
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(SIZE * 0.52, SIZE * 0.42, SIZE * 0.25, SIZE * 0.25);
      return canvas;
    },
  },
  {
    id: "compression",
    label: "Sent through a chat app",
    detail:
      "Messengers and social platforms re-encode images hard. Sharp black-and-white edges are exactly what that handles worst.",
    apply: (source) => {
      // Downscale and back up, which is the visible half of what aggressive
      // re-encoding does to a fine grid.
      const small = canvasOf(180);
      const smallCtx = small.getContext("2d")!;
      ground(smallCtx, 180, 180);
      smallCtx.drawImage(source, 0, 0, 180, 180);

      const canvas = canvasOf(SIZE);
      const ctx = canvas.getContext("2d")!;
      ground(ctx, SIZE, SIZE);
      ctx.drawImage(small, 0, 0, SIZE, SIZE);
      return canvas;
    },
  },
];

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function stressTestSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

/**
 * Runs every condition against the given code and reports which ones a real
 * reader could still decode back to `expected`.
 */
export async function runStressTest(source: ImageBitmap, expected: string): Promise<StressReport> {
  if (!stressTestSupported()) {
    return { supported: false, outcomes: [], passed: 0, total: CONDITIONS.length };
  }

  const Detector = (window as unknown as { BarcodeDetector: new (o: object) => DetectorLike })
    .BarcodeDetector;
  const detector = new Detector({ formats: ["qr_code"] });

  // The conditions are independent, so they are decoded together rather than
  // in sequence — eight round trips through the reader is otherwise a
  // noticeable wait for something triggered by a button.
  const outcomes: StressOutcome[] = await Promise.all(
    CONDITIONS.map(async (condition) => {
      let decoded = false;
      try {
        const found = await detector.detect(condition.apply(source));
        // It has to come back as the same payload — a partial read is a failure.
        decoded = found.some((code) => code.rawValue === expected);
      } catch {
        decoded = false;
      }
      return {
        id: condition.id,
        label: condition.label,
        detail: condition.detail,
        decoded,
      };
    }),
  );

  return {
    supported: true,
    outcomes,
    passed: outcomes.filter((o) => o.decoded).length,
    total: outcomes.length,
  };
}

/** How each failure reads as a sentence about the real world. */
const WEAKNESS: Record<string, string> = {
  distance: "at small sizes or across a room",
  blur: "when the camera is not sharp",
  ink: "once ink spreads on cheap paper",
  glare: "under glare or poor light",
  angle: "when held at an angle",
  damage: "if anything covers or scuffs it",
  compression: "after a messenger re-encodes it",
};

/**
 * One line naming the actual weakness rather than grading the run. "5 of 8"
 * says nothing useful on its own; which five is the whole point.
 */
export function summarise(report: StressReport): string {
  if (!report.supported) return "";
  if (report.outcomes.length === 0) return "";

  if (report.outcomes.some((o) => o.id === "clean" && !o.decoded)) {
    return "Failed even a clean render — this code does not scan as designed.";
  }
  if (report.passed === report.total) {
    return "Read under every condition tried, including damage and re-encoding.";
  }

  const phrases = report.outcomes
    .filter((o) => !o.decoded)
    .map((o) => WEAKNESS[o.id])
    .filter(Boolean);

  if (phrases.length === 0) return "Read under every condition tried.";

  const list =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;

  return `Reads cleanly, but gives out ${list}.`;
}
