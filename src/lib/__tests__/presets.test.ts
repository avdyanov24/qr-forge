import { describe, expect, it } from "vitest";
import { analyzeRisk, DEFAULT_CONFIG, type QrConfig } from "../qr";
import { DEFAULT_LAYOUT, analyzePrintRisk, type LayoutConfig } from "../templates";
import { applyPreset, PRESETS } from "../presets";

const applied = (index: number) => applyPreset(PRESETS[index], DEFAULT_CONFIG, DEFAULT_LAYOUT);

describe("PRESETS", () => {
  it("gives every preset a unique id", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names every preset and says what it is for", () => {
    for (const preset of PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.note.length).toBeGreaterThan(20);
    }
  });

  it("mentions the level whenever a preset changes it", () => {
    for (const preset of PRESETS) {
      if (!preset.code.ecc) continue;
      // A silent change to error correction would move a scan-risk threshold
      // without saying so.
      expect(preset.note).toMatch(new RegExp(`Level ${preset.code.ecc}`, "i"));
    }
  });
});

// The whole point of this app is catching codes that do not scan. A preset
// that ships with a warning already showing would undercut every other check.
describe("every preset is clean by the app's own rules", () => {
  it.each(PRESETS.map((p, i) => [p.name, i] as const))("%s raises no code findings", (_, index) => {
    expect(analyzeRisk(applied(index).config)).toEqual([]);
  });

  it.each(PRESETS.map((p, i) => [p.name, i] as const))(
    "%s raises no print findings",
    (_, index) => {
      const { config, layout } = applied(index);
      expect(analyzePrintRisk(config, layout, 25)).toEqual([]);
    },
  );

  it("keeps the code's background equal to the piece's", () => {
    // Where they differ the code prints as a visible tile, which is a finding.
    for (let i = 0; i < PRESETS.length; i++) {
      const { config, layout } = applied(i);
      expect(config.background.toLowerCase()).toBe(layout.background.toLowerCase());
    }
  });
});

describe("applyPreset", () => {
  const content: QrConfig = {
    ...DEFAULT_CONFIG,
    data: "https://example.com/keep-me",
    logo: "data:image/png;base64,AAAA",
  };
  const piece: LayoutConfig = {
    ...DEFAULT_LAYOUT,
    template: "poster",
    headline: "Keep this",
    sub: "and this",
    logo: "data:image/png;base64,BBBB",
    backgroundImage: "data:image/png;base64,CCCC",
  };

  it("never replaces the encoded text", () => {
    for (const preset of PRESETS) {
      expect(applyPreset(preset, content, piece).config.data).toBe(content.data);
    }
  });

  it("never removes an uploaded logo from the code", () => {
    for (const preset of PRESETS) {
      expect(applyPreset(preset, content, piece).config.logo).toBe(content.logo);
    }
  });

  it("leaves the template, copy and uploaded images on the piece alone", () => {
    for (const preset of PRESETS) {
      const { layout } = applyPreset(preset, content, piece);
      expect(layout.template).toBe("poster");
      expect(layout.headline).toBe("Keep this");
      expect(layout.sub).toBe("and this");
      expect(layout.logo).toBe(piece.logo);
      expect(layout.backgroundImage).toBe(piece.backgroundImage);
    }
  });

  it("does change the appearance it claims to", () => {
    const orbit = PRESETS.find((p) => p.id === "orbit")!;
    const { config } = applyPreset(orbit, content, piece);
    expect(config.shape).toBe("circle");
  });

  it("does not mutate what it is given", () => {
    const before = JSON.stringify({ content, piece });
    applyPreset(PRESETS[0], content, piece);
    expect(JSON.stringify({ content, piece })).toBe(before);
  });
});
