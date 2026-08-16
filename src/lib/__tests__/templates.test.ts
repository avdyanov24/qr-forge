import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type QrConfig } from "../qr";
import { placementRect } from "../patterns";
import {
  analyzePrintRisk,
  DEFAULT_LAYOUT,
  EXPORT_DPI,
  moduleSizeMm,
  planSheet,
  px,
  qrWidthMm,
  safeCodeRadiusMm,
  TEMPLATES,
  templateById,
  wrap,
  type LayoutConfig,
} from "../templates";

const config = (overrides: Partial<QrConfig> = {}): QrConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});
const layout = (overrides: Partial<LayoutConfig> = {}): LayoutConfig => ({
  ...DEFAULT_LAYOUT,
  ...overrides,
});

/** measureText stub: one unit per character, so widths are predictable. */
const ctx = (perChar = 10) => ({
  measureText: (text: string) => ({ width: text.length * perChar }) as TextMetrics,
});

describe("px", () => {
  it("converts millimetres to pixels at the given resolution", () => {
    // 25.4 mm is one inch, so it must equal the dpi exactly.
    expect(px(25.4, 300)).toBe(300);
    expect(px(25.4, 150)).toBe(150);
  });

  it("produces the standard A5 pixel size at print resolution", () => {
    expect(px(148, EXPORT_DPI)).toBe(1748);
    expect(px(210, EXPORT_DPI)).toBe(2480);
  });

  it("rounds to whole pixels", () => {
    expect(Number.isInteger(px(50, 300))).toBe(true);
  });
});

describe("templateById", () => {
  it("finds each template by its id", () => {
    for (const template of TEMPLATES) {
      expect(templateById(template.id).id).toBe(template.id);
    }
  });

  it("falls back rather than returning undefined for an unknown id", () => {
    expect(templateById("nope" as never)).toBe(TEMPLATES[0]);
  });

  it("gives every template a positive trim size and a code that fits inside it", () => {
    for (const template of TEMPLATES) {
      expect(template.widthMm).toBeGreaterThan(0);
      expect(template.heightMm).toBeGreaterThan(0);
      expect(template.qrMm).toBeLessThan(Math.min(template.widthMm, template.heightMm));
    }
  });
});

describe("qrWidthMm", () => {
  it("returns the template's own width at scale 1", () => {
    const template = templateById("card");
    expect(qrWidthMm(layout({ qrScale: 1 }), template)).toBe(template.qrMm);
  });

  it("scales proportionally", () => {
    const template = templateById("card");
    expect(qrWidthMm(layout({ qrScale: 0.5 }), template)).toBe(template.qrMm * 0.5);
  });
});

describe("moduleSizeMm", () => {
  const template = templateById("card"); // 32 mm code

  it("returns null when the module count is unknown", () => {
    expect(moduleSizeMm(config(), template, null)).toBeNull();
  });

  it("divides the code's printed width by the modules across it", () => {
    // 32 mm at scale 1, 10% quiet zone each side leaves 80% for 25 modules.
    const size = moduleSizeMm(config({ margin: 0.1 }), template, 25, layout({ qrScale: 1 }));
    expect(size).toBeCloseTo((32 * 0.8) / 25, 6);
  });

  it("shrinks as the payload grows", () => {
    const few = moduleSizeMm(config(), template, 25, layout());
    const many = moduleSizeMm(config(), template, 77, layout());
    expect(many!).toBeLessThan(few!);
  });

  it("grows when the code is enlarged on the piece", () => {
    const small = moduleSizeMm(config(), template, 41, layout({ qrScale: 0.6 }));
    const large = moduleSizeMm(config(), template, 41, layout({ qrScale: 1.6 }));
    expect(large!).toBeGreaterThan(small!);
  });

  it("accounts for the quiet zone eating into the printed width", () => {
    const tight = moduleSizeMm(config({ margin: 0 }), template, 41, layout());
    const wide = moduleSizeMm(config({ margin: 0.12 }), template, 41, layout());
    expect(wide!).toBeLessThan(tight!);
  });
});

describe("analyzePrintRisk — physical module size", () => {
  const titles = (moduleCount: number, over: Partial<LayoutConfig> = {}) =>
    analyzePrintRisk(config(), layout(over), moduleCount).map((f) => f.title);

  it("says nothing when modules are comfortably large", () => {
    // Bookmark, few modules — around 1 mm each.
    expect(titles(25)).not.toContain("Modules near the print limit");
    expect(titles(25)).not.toContain("Modules too small to print");
  });

  it("cautions once modules fall under 0.4 mm", () => {
    // 34 mm code, 10% quiet zone → 27.2 mm across; 77 modules ≈ 0.35 mm.
    expect(titles(77)).toContain("Modules near the print limit");
  });

  it("escalates once modules fall under 0.3 mm", () => {
    // 27.2 mm across 101 modules ≈ 0.27 mm.
    expect(titles(101)).toContain("Modules too small to print");
    expect(titles(101)).not.toContain("Modules near the print limit");
  });

  it("can be rescued by enlarging the code rather than shortening the text", () => {
    expect(titles(77)).toContain("Modules near the print limit");
    expect(titles(77, { qrScale: 1.6 })).not.toContain("Modules near the print limit");
  });

  it("says nothing about module size when the count is unknown", () => {
    const found = analyzePrintRisk(config(), layout(), null).map((f) => f.title);
    expect(found).not.toContain("Modules too small to print");
    expect(found).not.toContain("Modules near the print limit");
  });
});

describe("analyzePrintRisk — the code's own background", () => {
  it("says nothing when the code matches the piece", () => {
    const found = analyzePrintRisk(
      config({ background: "#E8E6E1" }),
      layout({ background: "#E8E6E1" }),
      25,
    );
    expect(found.map((f) => f.title)).not.toContain("Code prints as a visible tile");
  });

  it("flags a mismatch, whatever the casing", () => {
    const found = analyzePrintRisk(
      config({ background: "#e8e6e1" }),
      layout({ background: "#FFFFFF" }),
      25,
    );
    expect(found.map((f) => f.title)).toContain("Code prints as a visible tile");
  });

  it("explains the pattern case differently, since the tile is what protects the quiet zone", () => {
    const patterned = analyzePrintRisk(
      config({ background: "#FFFFFF" }),
      layout({ background: "#E8E6E1", pattern: "waves" }),
      25,
    ).find((f) => f.title === "Code prints as a visible tile");
    expect(patterned?.detail).toMatch(/quiet zone/i);
  });
});

describe("wrap", () => {
  it("returns nothing for empty or whitespace-only text", () => {
    expect(wrap(ctx(), "", 100, 2)).toEqual([]);
    expect(wrap(ctx(), "   ", 100, 2)).toEqual([]);
  });

  it("keeps text on one line when it fits", () => {
    expect(wrap(ctx(), "abc", 100, 2)).toEqual(["abc"]);
  });

  it("breaks on words once the line is full", () => {
    // 10px per char, 60px wide → 6 characters per line.
    expect(wrap(ctx(), "abc def", 60, 2)).toEqual(["abc", "def"]);
  });

  it("never exceeds the line limit", () => {
    expect(wrap(ctx(), "aa bb cc dd ee ff", 30, 2)).toHaveLength(2);
  });

  it("marks truncation with an ellipsis rather than running past the trim", () => {
    const lines = wrap(ctx(), "aa bb cc dd ee ff", 30, 2);
    expect(lines[lines.length - 1]).toMatch(/…$/);
  });

  it("keeps every line within the width once truncated", () => {
    const lines = wrap(ctx(), "aa bb cc dd ee ff", 30, 2);
    for (const line of lines) {
      expect(line.length * 10).toBeLessThanOrEqual(30);
    }
  });

  it("keeps the start of a single word too wide to fit, rather than showing only an ellipsis", () => {
    const lines = wrap(ctx(), "unbreakable", 20, 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^u/);
  });

  it("never emits an empty line", () => {
    for (const text of ["unbreakable", "aa bb cc dd ee ff", "a", "a    b"]) {
      for (const line of wrap(ctx(), text, 20, 2)) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("collapses runs of whitespace", () => {
    expect(wrap(ctx(), "a    b", 1000, 2)).toEqual(["a b"]);
  });
});

describe("planSheet", () => {
  it("fits eight business cards on A4", () => {
    // 190 × 277 mm usable, 4 mm gutter: (190+4)/(85+4) = 2, (277+4)/(55+4) = 4.
    expect(planSheet(layout({ template: "card" }))).toEqual({
      columns: 2,
      rows: 4,
      perSheet: 8,
    });
  });

  it("fits fewer of a larger piece", () => {
    const cards = planSheet(layout({ template: "card" })).perSheet;
    const flyers = planSheet(layout({ template: "flyer" })).perSheet;
    expect(flyers).toBeLessThan(cards);
    expect(flyers).toBeGreaterThan(0);
  });

  it("reports zero rather than a negative count when nothing fits", () => {
    // A5 poster is 148 × 210; two will not sit side by side inside the margins.
    const plan = planSheet(layout({ template: "poster" }));
    expect(plan.columns).toBeGreaterThanOrEqual(0);
    expect(plan.rows).toBeGreaterThanOrEqual(0);
    expect(plan.perSheet).toBe(plan.columns * plan.rows);
  });

  it("never claims a piece fits more times than the paper allows", () => {
    for (const template of TEMPLATES) {
      const plan = planSheet(layout({ template: template.id }));
      const usedW = plan.columns * template.widthMm;
      const usedH = plan.rows * template.heightMm;
      expect(usedW).toBeLessThanOrEqual(190);
      expect(usedH).toBeLessThanOrEqual(277);
    }
  });
});

describe("placementRect", () => {
  it("covers the whole piece by default", () => {
    expect(placementRect("full", 100, 200)).toEqual([0, 0, 100, 200]);
  });

  it("keeps a band inside the piece", () => {
    for (const placement of ["top", "bottom", "left", "right"] as const) {
      const [x, y, w, h] = placementRect(placement, 100, 200);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(100);
      expect(y + h).toBeLessThanOrEqual(200);
    }
  });

  it("puts the bottom band below the top band", () => {
    const [, topY] = placementRect("top", 100, 200);
    const [, bottomY] = placementRect("bottom", 100, 200);
    expect(bottomY).toBeGreaterThan(topY);
  });
});

describe("safeCodeRadiusMm", () => {
  it("scales with the quiet zone, which is the only thing rounding can eat", () => {
    const narrow = safeCodeRadiusMm(config({ margin: 0.05 }), layout());
    const wide = safeCodeRadiusMm(config({ margin: 0.15 }), layout());
    expect(wide).toBeCloseTo(narrow * 3, 5);
  });

  it("is zero when there is no quiet zone at all", () => {
    expect(safeCodeRadiusMm(config({ margin: 0 }), layout())).toBe(0);
  });

  it("scales with the code's printed width", () => {
    const small = safeCodeRadiusMm(config(), layout({ qrScale: 0.5 }));
    const large = safeCodeRadiusMm(config(), layout({ qrScale: 1.5 }));
    expect(large).toBeCloseTo(small * 3, 5);
  });

  it("allows a radius far larger than the quiet zone itself", () => {
    // The corner only bites along the diagonal, so the limit is ~3.41× the
    // quiet zone, not 1×. Being wrong here would forbid harmless rounding.
    const quietZoneMm = qrWidthMm(layout(), templateById("bookmark")) * DEFAULT_CONFIG.margin;
    expect(safeCodeRadiusMm(config(), layout())).toBeGreaterThan(quietZoneMm * 3);
  });
});

describe("analyzePrintRisk — rounded code corners", () => {
  const titles = (over: Partial<LayoutConfig>, cfg = config()) =>
    analyzePrintRisk(cfg, layout(over), 25).map((f) => f.title);

  it("says nothing when the code is not rounded", () => {
    expect(titles({ qrRadiusMm: 0 })).not.toContain("Rounding is cutting into the code");
  });

  it("says nothing while the rounding stays inside the quiet zone", () => {
    const safe = safeCodeRadiusMm(config(), layout());
    expect(titles({ qrRadiusMm: safe - 0.5 })).not.toContain("Rounding is cutting into the code");
  });

  it("warns once the rounding reaches the modules", () => {
    const safe = safeCodeRadiusMm(config(), layout());
    expect(titles({ qrRadiusMm: safe + 0.5 })).toContain("Rounding is cutting into the code");
  });

  it("warns about any rounding when there is no quiet zone", () => {
    expect(titles({ qrRadiusMm: 0.5 }, config({ margin: 0 }))).toContain(
      "Rounding is cutting into the code",
    );
  });

  it("treats it as critical, since a clipped corner is a finder pattern", () => {
    const safe = safeCodeRadiusMm(config(), layout());
    const finding = analyzePrintRisk(config(), layout({ qrRadiusMm: safe + 2 }), 25).find(
      (f) => f.title === "Rounding is cutting into the code",
    );
    expect(finding?.level).toBe("critical");
  });
});
