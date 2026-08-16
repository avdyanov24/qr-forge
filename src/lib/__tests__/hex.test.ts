import { describe, expect, it } from "vitest";
import { normalizeHex } from "../../components/Controls";

describe("normalizeHex", () => {
  it("accepts a complete six-digit value", () => {
    expect(normalizeHex("#C8A24A")).toBe("#C8A24A");
  });

  it("upper-cases so one representation reaches the renderer", () => {
    expect(normalizeHex("#c8a24a")).toBe("#C8A24A");
  });

  it("expands three-digit shorthand", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("#000")).toBe("#000000");
    expect(normalizeHex("#fff")).toBe("#FFFFFF");
  });

  it("tolerates surrounding whitespace", () => {
    expect(normalizeHex("  #C8A24A  ")).toBe("#C8A24A");
  });

  // Everything below is a value that can exist mid-typing. None of it may
  // reach the render options, which is what issue #9 was about.
  it.each(["", "#", "#C", "#C8", "#C8A2", "#C8A24", "#C8A24AB"])(
    "rejects the incomplete value %o",
    (partial) => {
      expect(normalizeHex(partial)).toBeNull();
    },
  );

  // Typing a six-digit value passes through a valid three-digit one, so the
  // preview briefly shows the shorthand colour. That is the accepted cost of
  // supporting shorthand at all, and it is pinned here so the behaviour is a
  // decision rather than a surprise.
  it("treats three characters as shorthand rather than an unfinished six", () => {
    expect(normalizeHex("#C8A")).toBe("#CC88AA");
  });

  it("rejects non-hex characters", () => {
    expect(normalizeHex("#ZZZZZZ")).toBeNull();
    expect(normalizeHex("rebeccapurple")).toBeNull();
  });

  it("rejects a value with no hash", () => {
    expect(normalizeHex("C8A24A")).toBeNull();
  });
});
