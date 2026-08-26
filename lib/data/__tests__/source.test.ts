import { describe, it, expect } from "vitest";
import { totalSessions, shouldUseSampleData } from "../source";

const bundle = (n: Partial<Record<"erg" | "water" | "team" | "dryland", number>>) => ({
  erg: Array(n.erg ?? 0).fill({}),
  water: Array(n.water ?? 0).fill({}),
  team: Array(n.team ?? 0).fill({}),
  dryland: Array(n.dryland ?? 0).fill({}),
});

describe("totalSessions", () => {
  it("counts across every session type", () => {
    expect(totalSessions(bundle({ erg: 2, water: 1, team: 3, dryland: 1 }))).toBe(7);
  });

  it("is zero for a fresh install", () => {
    expect(totalSessions(bundle({}))).toBe(0);
  });

  it("counts a single session of any one type", () => {
    // The interesting boundary: one logged session must stop sample data.
    expect(totalSessions(bundle({ dryland: 1 }))).toBe(1);
  });
});

describe("shouldUseSampleData", () => {
  it("shows samples to a demo visitor with nothing logged", () => {
    expect(shouldUseSampleData(bundle({}), true)).toBe(true);
  });

  it("stops showing samples the moment one session exists", () => {
    // Regression: this was the whole bug. An athlete on the deployed site
    // logged a session and still saw 147 sample sessions and someone else's
    // 18.5km training week, with their own session on no screen at all.
    expect(shouldUseSampleData(bundle({ erg: 1 }), true)).toBe(false);
    expect(shouldUseSampleData(bundle({ water: 1 }), true)).toBe(false);
    expect(shouldUseSampleData(bundle({ team: 1 }), true)).toBe(false);
    expect(shouldUseSampleData(bundle({ dryland: 1 }), true)).toBe(false);
  });

  it("never shows samples to a configured account", () => {
    // For them "no sessions" is the truth, and filling it with someone else's
    // training is a lie they could act on.
    expect(shouldUseSampleData(bundle({}), false)).toBe(false);
    expect(shouldUseSampleData(bundle({ erg: 5 }), false)).toBe(false);
  });
});
