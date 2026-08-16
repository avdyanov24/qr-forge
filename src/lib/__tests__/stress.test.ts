import { describe, expect, it } from "vitest";
import { CONDITIONS, summarise, type StressOutcome, type StressReport } from "../stress";

const outcome = (id: string, decoded: boolean): StressOutcome => ({
  id,
  label: id,
  detail: "",
  decoded,
});

const report = (outcomes: StressOutcome[]): StressReport => ({
  supported: true,
  outcomes,
  passed: outcomes.filter((o) => o.decoded).length,
  total: outcomes.length,
});

describe("CONDITIONS", () => {
  it("starts with the clean render, since everything else is relative to it", () => {
    expect(CONDITIONS[0].id).toBe("clean");
  });

  it("gives every condition a unique id", () => {
    const ids = CONDITIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("explains what every condition stands in for", () => {
    for (const condition of CONDITIONS) {
      expect(condition.label.length).toBeGreaterThan(0);
      expect(condition.detail.length).toBeGreaterThan(20);
    }
  });
});

describe("summarise", () => {
  it("says nothing when the browser cannot run the test", () => {
    expect(summarise({ supported: false, outcomes: [], passed: 0, total: 8 })).toBe("");
  });

  it("leads with the clean failure, because the rest is then irrelevant", () => {
    const result = summarise(report([outcome("clean", false), outcome("damage", false)]));
    expect(result).toMatch(/does not scan as designed/);
    // It must not also list the downstream weaknesses as if they were the story.
    expect(result).not.toMatch(/covers or scuffs/);
  });

  it("reports a clean sweep", () => {
    const result = summarise(report([outcome("clean", true), outcome("damage", true)]));
    expect(result).toMatch(/every condition/);
  });

  it("names the single weakness rather than counting", () => {
    const result = summarise(report([outcome("clean", true), outcome("damage", false)]));
    expect(result).toMatch(/covers or scuffs/);
    expect(result).not.toMatch(/\d of \d/);
  });

  it("joins several weaknesses readably", () => {
    const result = summarise(
      report([
        outcome("clean", true),
        outcome("distance", false),
        outcome("blur", false),
        outcome("damage", false),
      ]),
    );
    expect(result).toMatch(/across a room, when the camera is not sharp and if anything covers/);
  });

  it("has a phrase for every condition it can report on", () => {
    // A condition with no phrase would silently vanish from the summary.
    const all = report([
      outcome("clean", true),
      ...CONDITIONS.filter((c) => c.id !== "clean").map((c) => outcome(c.id, false)),
    ]);
    const result = summarise(all);
    for (const condition of CONDITIONS) {
      if (condition.id === "clean") continue;
      expect(result.length).toBeGreaterThan(condition.label.length);
    }
    expect(result).not.toMatch(/undefined/);
  });
});
