import { describe, it, expect } from "vitest";
import { trainingMix, totalWeekSessions, describeMix } from "../training-mix";

const counts = (erg = 0, water = 0, team = 0, dryland = 0) => ({ erg, water, team, dryland });

describe("trainingMix", () => {
  it("splits the week by modality", () => {
    const mix = trainingMix(counts(2, 1, 1, 0));
    expect(mix.find((m) => m.modality === "erg")!.share).toBe(50);
    expect(mix.find((m) => m.modality === "water")!.share).toBe(25);
    expect(mix.find((m) => m.modality === "dryland")!.share).toBe(0);
  });

  it("always returns all four, including the empty ones", () => {
    // The gap is the most useful thing on the chart; hiding an empty bar
    // hides exactly what an athlete needs to notice.
    const mix = trainingMix(counts(3));
    expect(mix).toHaveLength(4);
    expect(mix.map((m) => m.modality)).toEqual(["erg", "water", "team", "dryland"]);
  });

  it("counts sessions, not distance", () => {
    // Distance can't compare across modalities — a 45-minute lifting session
    // has no distance at all, and would vanish from a distance-based mix.
    const mix = trainingMix(counts(1, 0, 0, 1));
    expect(mix.find((m) => m.modality === "dryland")!.share).toBe(50);
  });

  it("shares add up to about 100", () => {
    for (const c of [counts(1, 1, 1), counts(3, 2), counts(1, 1, 1, 1), counts(5, 3, 2, 1)]) {
      const total = trainingMix(c).reduce((n, m) => n + m.share, 0);
      expect(Math.abs(total - 100)).toBeLessThanOrEqual(2); // rounding
    }
  });

  it("shows zeroes rather than NaN for a week with no training", () => {
    // Regression: the old card divided by hardcoded denominators, so an empty
    // week still rendered percentages of a goal nobody set.
    const mix = trainingMix(counts());
    expect(mix.every((m) => m.share === 0)).toBe(true);
    expect(mix.every((m) => Number.isFinite(m.share))).toBe(true);
  });

  it("ignores negative or missing counts", () => {
    const mix = trainingMix({ erg: 2, water: -1 } as never);
    expect(mix.find((m) => m.modality === "water")!.sessions).toBe(0);
    expect(mix.find((m) => m.modality === "erg")!.share).toBe(100);
  });
});

describe("totalWeekSessions", () => {
  it("adds up every modality", () => {
    expect(totalWeekSessions(counts(2, 1, 1, 1))).toBe(5);
    expect(totalWeekSessions(counts())).toBe(0);
  });
});

describe("describeMix", () => {
  it("stays quiet until the week has a shape", () => {
    // One session isn't a lopsided week, it's a Monday.
    expect(describeMix(counts(1))).toBeNull();
    expect(describeMix(counts(1, 1))).toBeNull();
  });

  it("points out a week spent entirely on one thing", () => {
    const line = describeMix(counts(4))!;
    expect(line).toMatch(/almost all erg/i);
    expect(line).toMatch(/water/i);
  });

  it("says so when everything is covered", () => {
    expect(describeMix(counts(2, 1, 1, 1))).toMatch(/all four/i);
  });

  it("says nothing about a reasonably balanced week with a gap", () => {
    // Not every imperfect week needs a comment.
    expect(describeMix(counts(2, 2, 1))).toBeNull();
  });
});
