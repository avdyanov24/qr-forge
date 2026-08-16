import { describe, expect, it } from "vitest";
import {
  analyzeRisk,
  buildOptions,
  contrastRatio,
  DEFAULT_CONFIG,
  describeEncodeError,
  ECC_GUIDE,
  ECC_LEVELS,
  filename,
  logoCoverage,
  type QrConfig,
} from "../qr";

const config = (overrides: Partial<QrConfig> = {}): QrConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const titles = (c: QrConfig) => analyzeRisk(c).map((f) => f.title);
const find = (c: QrConfig, title: string) => analyzeRisk(c).find((f) => f.title === title);

describe("contrastRatio", () => {
  it("returns the extremes for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("is 1:1 for a colour against itself", () => {
    expect(contrastRatio("#C8A24A", "#C8A24A")).toBeCloseTo(1, 5);
  });

  it("is order independent", () => {
    expect(contrastRatio("#08080A", "#E8E6E1")).toBeCloseTo(
      contrastRatio("#E8E6E1", "#08080A"),
      10,
    );
  });

  it("accepts three-digit shorthand", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 0);
  });

  it("is case insensitive", () => {
    expect(contrastRatio("#c8a24a", "#E8E6E1")).toBeCloseTo(
      contrastRatio("#C8A24A", "#e8e6e1"),
      10,
    );
  });
});

describe("logoCoverage", () => {
  it("is zero with no logo, whatever the scale says", () => {
    expect(logoCoverage(config({ logo: null, logoScale: 1 }))).toEqual({
      budgetShare: 0,
      moduleShare: 0,
    });
  });

  it("treats the scale as a share of the recovery budget, not of the width", () => {
    // The library blanks imageSize * eccPercent * modules^2, so a logo at half
    // scale on level Q spends half of Q's 25%.
    expect(logoCoverage(config({ logo: "data:,", logoScale: 0.5, ecc: "Q" }))).toEqual({
      budgetShare: 0.5,
      moduleShare: 0.125,
    });
  });

  it("blanks fewer modules at a lower level for the same scale", () => {
    const atL = logoCoverage(config({ logo: "data:,", logoScale: 1, ecc: "L" }));
    const atH = logoCoverage(config({ logo: "data:,", logoScale: 1, ecc: "H" }));
    expect(atL.moduleShare).toBeLessThan(atH.moduleShare);
    expect(atL.budgetShare).toBe(atH.budgetShare);
  });
});

describe("analyzeRisk — logo budget", () => {
  const withLogo = (logoScale: number) => config({ logo: "data:,", logoScale });

  it("says nothing at half the budget", () => {
    expect(titles(withLogo(0.5))).not.toContain("Logo near recovery limit");
    expect(titles(withLogo(0.5))).not.toContain("No recovery margin left");
  });

  it("cautions just above 60% of the budget", () => {
    expect(titles(withLogo(0.61))).toContain("Logo near recovery limit");
  });

  it("stays quiet just below 60%", () => {
    expect(titles(withLogo(0.59))).not.toContain("Logo near recovery limit");
  });

  it("escalates just above 85% of the budget", () => {
    expect(titles(withLogo(0.86))).toContain("No recovery margin left");
    expect(titles(withLogo(0.86))).not.toContain("Logo near recovery limit");
  });

  it("is still only a caution just below 85%", () => {
    expect(titles(withLogo(0.84))).toContain("Logo near recovery limit");
  });

  it("never fires without a logo", () => {
    expect(titles(config({ logo: null, logoScale: 1 }))).not.toContain("No recovery margin left");
  });
});

describe("analyzeRisk — contrast by region", () => {
  it("passes the default palette", () => {
    expect(titles(config())).toEqual([]);
  });

  it("treats a faint foreground as critical, since it takes the whole code", () => {
    const finding = find(config({ foreground: "#D8D6D1" }), "Insufficient contrast");
    expect(finding?.level).toBe("critical");
  });

  it("treats faint finder patterns as critical — they carry no error correction", () => {
    const finding = find(config({ cornerColor: "#EDEBE6" }), "Finder patterns too faint");
    expect(finding?.level).toBe("critical");
  });

  it("treats a faint gradient end as a caution — error correction can absorb it", () => {
    const finding = find(
      config({ gradient: { type: "linear", color: "#EDEBE6", rotation: 0 } }),
      "Gradient end is faint",
    );
    expect(finding?.level).toBe("marginal");
  });

  it("reports the weakest ink when several are in play", () => {
    // Foreground is fine, corners are worse than the gradient end.
    const c = config({
      cornerColor: "#EDEBE6",
      gradient: { type: "linear", color: "#9A9791", rotation: 0 },
    });
    expect(titles(c)).toContain("Finder patterns too faint");
    expect(titles(c)).not.toContain("Gradient end is faint");
  });

  it("ignores a gradient colour that is not in use", () => {
    expect(titles(config({ gradient: null, cornerColor: null }))).toEqual([]);
  });

  // These two greys sit one hex step apart either side of 3:1 against #E8E6E1,
  // which is passed explicitly so the threshold stays pinned no matter what the
  // product default background becomes.
  it("accepts a foreground just above 3:1", () => {
    expect(contrastRatio("#838383", "#E8E6E1")).toBeGreaterThan(3);
    expect(titles(config({ foreground: "#838383", background: "#E8E6E1" }))).not.toContain(
      "Insufficient contrast",
    );
  });

  it("rejects a foreground just below 3:1", () => {
    expect(contrastRatio("#848484", "#E8E6E1")).toBeLessThan(3);
    expect(titles(config({ foreground: "#848484", background: "#E8E6E1" }))).toContain(
      "Insufficient contrast",
    );
  });

  it("pins the same threshold for the finder patterns", () => {
    expect(titles(config({ cornerColor: "#838383", background: "#E8E6E1" }))).not.toContain(
      "Finder patterns too faint",
    );
    expect(titles(config({ cornerColor: "#848484", background: "#E8E6E1" }))).toContain(
      "Finder patterns too faint",
    );
  });

  it("pins the same threshold for the gradient end", () => {
    const above = config({
      background: "#E8E6E1",
      gradient: { type: "linear", color: "#838383", rotation: 0 },
    });
    const below = config({
      background: "#E8E6E1",
      gradient: { type: "linear", color: "#848484", rotation: 0 },
    });
    expect(titles(above)).not.toContain("Gradient end is faint");
    expect(titles(below)).toContain("Gradient end is faint");
  });
});

describe("analyzeRisk — polarity and quiet zone", () => {
  it("flags light modules on a dark field", () => {
    expect(titles(config({ foreground: "#E8E6E1", background: "#08080A" }))).toContain(
      "Inverted polarity",
    );
  });

  it("accepts the conventional dark on light", () => {
    expect(titles(config())).not.toContain("Inverted polarity");
  });

  it("accepts the default quiet zone", () => {
    expect(titles(config())).not.toContain("Quiet zone below specification");
  });

  it("flags a quiet zone narrowed past the floor", () => {
    expect(titles(config({ margin: 0.02 }))).toContain("Quiet zone below specification");
  });

  it("flags no quiet zone at all", () => {
    expect(titles(config({ margin: 0 }))).toContain("Quiet zone below specification");
  });
});

describe("buildOptions", () => {
  it("scales the margin with the requested size", () => {
    expect(buildOptions(config({ margin: 0.1 }), 1000).margin).toBe(100);
    expect(buildOptions(config({ margin: 0.1 }), 500).margin).toBe(50);
  });

  it("converts gradient rotation from degrees to radians", () => {
    const options = buildOptions(
      config({ gradient: { type: "linear", color: "#FFFFFF", rotation: 180 } }),
      512,
    );
    expect(options.dotsOptions?.gradient?.rotation).toBeCloseTo(Math.PI, 5);
  });

  it("does not rotate a radial gradient", () => {
    const options = buildOptions(
      config({ gradient: { type: "radial", color: "#FFFFFF", rotation: 90 } }),
      512,
    );
    expect(options.dotsOptions?.gradient?.rotation).toBe(0);
  });

  it("drops the gradient on the corners when they are given their own colour", () => {
    const options = buildOptions(
      config({
        cornerColor: "#C8A24A",
        gradient: { type: "linear", color: "#FFFFFF", rotation: 0 },
      }),
      512,
    );
    expect(options.cornersSquareOptions?.color).toBe("#C8A24A");
    expect(options.cornersSquareOptions?.gradient).toBeUndefined();
    // The body of the code keeps it.
    expect(options.dotsOptions?.gradient).toBeDefined();
  });

  it("gives the corners the gradient when they match the foreground", () => {
    const options = buildOptions(
      config({ cornerColor: null, gradient: { type: "linear", color: "#FFF", rotation: 0 } }),
      512,
    );
    expect(options.cornersSquareOptions?.gradient).toBeDefined();
  });

  it("omits the image when no logo is set", () => {
    expect(buildOptions(config({ logo: null }), 512).image).toBeUndefined();
  });
});

describe("describeEncodeError", () => {
  it("turns a capacity overflow into advice, not a bit count", () => {
    const message = describeEncodeError(new Error("code length overflow. (32020>13328)"));
    expect(message).toMatch(/error correction level/i);
    expect(message).not.toMatch(/32020/);
  });

  it("handles a value that is not an Error", () => {
    expect(describeEncodeError("something odd")).toBeTruthy();
  });

  it("falls back rather than throwing on null", () => {
    expect(describeEncodeError(null)).toBeTruthy();
  });
});

describe("filename", () => {
  it("strips the scheme and slugs the host", () => {
    expect(filename("https://example.com", "png")).toBe("qr-example-com.png");
  });

  it("keeps the extension it is given", () => {
    expect(filename("https://example.com", "svg")).toBe("qr-example-com.svg");
  });

  it("collapses runs of punctuation into single hyphens", () => {
    expect(filename("https://example.com/a//b??c", "png")).toBe("qr-example-com-a-b-c.png");
  });

  it("does not leave a trailing hyphen", () => {
    expect(filename("https://example.com/", "png")).not.toMatch(/-\.png$/);
  });

  it("falls back when the text has nothing sluggable", () => {
    expect(filename("!!!", "png")).toBe("qr-code.png");
  });

  it("falls back on empty input", () => {
    expect(filename("", "png")).toBe("qr-code.png");
  });

  it("truncates a very long payload", () => {
    const name = filename("https://example.com/" + "a".repeat(200), "png");
    expect(name.length).toBeLessThanOrEqual(3 + 32 + 4);
  });
});

describe("ECC_GUIDE", () => {
  it("describes every level the control offers", () => {
    // A missing entry renders as "undefined" in the rail rather than failing.
    for (const level of ECC_LEVELS) {
      expect(ECC_GUIDE[level]).toBeDefined();
      expect(ECC_GUIDE[level].recovers).toMatch(/^\d+%$/);
      expect(ECC_GUIDE[level].use.length).toBeGreaterThan(5);
    }
  });

  it("quotes recovery rising with the level", () => {
    const percents = ECC_LEVELS.map((l) => Number.parseInt(ECC_GUIDE[l].recovers, 10));
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThan(percents[i - 1]);
    }
  });

  it("matches the budget the risk model actually uses", () => {
    // The rail must not promise a number the warnings contradict.
    const coverage = (level: (typeof ECC_LEVELS)[number]) =>
      logoCoverage(config({ logo: "data:,", logoScale: 1, ecc: level })).moduleShare;
    for (const level of ECC_LEVELS) {
      const quoted = Number.parseInt(ECC_GUIDE[level].recovers, 10) / 100;
      expect(coverage(level)).toBeCloseTo(quoted, 2);
    }
  });
});
