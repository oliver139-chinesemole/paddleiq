/**
 * Unit tests for the coaching rules engine.
 * All tests are pure — no DB, no network, no Supabase.
 */
import { describe, it, expect } from "vitest";
import { THRESHOLDS } from "../thresholds";
import {
  checkSplitFade,
  checkPacingConsistency,
  calculateTrainingLoad,
  checkHighRPEStreak,
  checkModalityGaps,
  checkBoatErgGap,
  checkPRProximity,
  computePRTrend,
  type ErgSessionInput,
  type WaterSessionInput,
  type DrylandSessionInput,
} from "../rules";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const TODAY = "2026-06-04";
const d = (daysAgo: number) => {
  const dt = new Date("2026-06-04");
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toISOString().split("T")[0];
};

const makeErg = (overrides: Partial<ErgSessionInput> = {}): ErgSessionInput => ({
  date: TODAY,
  rpe: 7,
  distance_m: 2000,
  duration_sec: 512,
  split_sec: 128,
  ...overrides,
});

const makeWater = (overrides: Partial<WaterSessionInput> = {}): WaterSessionInput => ({
  date: TODAY,
  rpe: 6,
  distance_m: 500,
  duration_sec: 150,
  avg_pace_sec: 150,
  ...overrides,
});

const makeDryland = (overrides: Partial<DrylandSessionInput> = {}): DrylandSessionInput => ({
  date: TODAY,
  rpe: 6,
  duration_min: 45,
  ...overrides,
});

// ── Rule 1: Split fade ────────────────────────────────────────────────────────
describe("checkSplitFade", () => {
  const withSplits = (splits: number[], extra: Record<string, unknown> = {}) =>
    makeErg({ distance_m: 2000, split_sec: 130, segment_splits: splits, ...extra });

  it("says nothing without recorded splits", () => {
    // Regression: this used to invent the segments from the overall split as
    // [s-2, s-1, s+1, s+2], so the fade was arithmetically always 4.0s. Every
    // athlete was told their 2k faded 4.0s in the last 500m and given pacing
    // advice about their anaerobic reserves, from no evidence at all.
    expect(checkSplitFade([])).toBeNull();
    expect(checkSplitFade([makeErg({ distance_m: 2000, split_sec: 130 })])).toBeNull();
  });

  it("ignores a piece with only one segment recorded", () => {
    // One number can't show a fade.
    expect(checkSplitFade([withSplits([128])])).toBeNull();
  });

  it("measures the fade actually recorded", () => {
    const result = checkSplitFade([withSplits([120, 124, 126, 130])]);
    expect(result).not.toBeNull();
    expect(result!.fadeSec).toBe(10);
    expect(result!.splitsSec).toEqual([120, 124, 126, 130]);
    expect(result!.fadingSegment).toBe("1500–2000m");
  });

  it("reports a different fade for a different athlete", () => {
    // The whole point: the number has to depend on the input.
    const a = checkSplitFade([withSplits([120, 121, 122, 123])])!;
    const b = checkSplitFade([withSplits([120, 130, 135, 140])])!;
    expect(a.fadeSec).not.toBe(b.fadeSec);
    expect(b.fadeSec).toBeGreaterThan(a.fadeSec);
  });

  it("names whichever segment is worst, not always the last", () => {
    const result = checkSplitFade([withSplits([120, 132, 126, 124])]);
    expect(result!.fadingSegment).toBe("500–1000m");
    expect(result!.fadeSec).toBe(12);
  });

  it("measures against the opening segment, which is what fade means", () => {
    // Not against the fastest: a quick third 500 shouldn't invent a fade.
    const result = checkSplitFade([withSplits([120, 122, 118, 121])]);
    expect(result!.fadeSec).toBe(2);
  });

  it("reports nothing for a negative split", () => {
    // Finishing faster than you started is the opposite of fading.
    expect(checkSplitFade([withSplits([130, 128, 126, 124])])).toBeNull();
  });

  it("grades severity from the real fade", () => {
    expect(checkSplitFade([withSplits([120, 121, 121, 122])])!.severity).toBe("ok");
    expect(checkSplitFade([withSplits([120, 124, 126, 130])])!.severity).toBe("severe");
  });

  it("handles a piece recorded in two or three segments", () => {
    expect(checkSplitFade([withSplits([120, 128])])!.fadeSec).toBe(8);
    const three = checkSplitFade([withSplits([120, 124, 129])])!;
    expect(three.segmentLabels).toEqual(["0–500m", "500–1000m", "1000–1500m"]);
  });

  it("uses the most recent piece that has splits", () => {
    const result = checkSplitFade([
      withSplits([120, 140, 140, 140], { date: d(10) }),
      withSplits([120, 121, 122, 123], { date: d(1) }),
    ]);
    expect(result!.fadeSec).toBe(3);
  });

  it("skips a session whose splits are unusable", () => {
    const result = checkSplitFade([
      withSplits([0, 0, 0, 0], { date: d(1) }),
      withSplits([120, 126, 128, 132], { date: d(5) }),
    ]);
    expect(result!.fadeSec).toBe(12);
  });
});

// ── Rule 2: Pacing consistency ───────────────────────────────────────────────
describe("checkPacingConsistency", () => {
  it("returns null with fewer than 3 sessions", () => {
    expect(checkPacingConsistency([])).toBeNull();
    expect(checkPacingConsistency([makeErg(), makeErg()])).toBeNull();
  });

  it("low variance → ok severity", () => {
    const sessions = [128, 128, 129, 128, 129].map((split_sec) => makeErg({ split_sec }));
    const result = checkPacingConsistency(sessions);
    expect(result!.severity).toBe("ok");
    expect(result!.stdDevSec).toBeLessThan(1);
  });

  it("high variance → warn severity", () => {
    const sessions = [120, 130, 120, 130, 125, 135].map((split_sec) => makeErg({ split_sec }));
    const result = checkPacingConsistency(sessions);
    expect(result!.severity).not.toBe("ok");
    expect(result!.stdDevSec).toBeGreaterThan(4);
  });
});

// ── Rule 3 + 4: Training load / ACWR ─────────────────────────────────────────
describe("calculateTrainingLoad", () => {
  it("returns acwr in safe band when load is consistent", () => {
    // 28 days of equal load — acute and chronic should be close
    const sessions = Array.from({ length: 28 }, (_, i) => ({
      date: d(i),
      rpe: 7,
      duration_min: 60,
    }));
    const result = calculateTrainingLoad(sessions, new Date("2026-06-04"));
    // With 28 even sessions: acute=7 sessions, chronic avg=7; ACWR should be ~1.0
    expect(result.acwr).toBeGreaterThan(0.7);
    expect(result.acwr).toBeLessThan(1.5);
    expect(result.severity).toBe("ok");
  });

  it("flags overreaching when acute load spikes", () => {
    // Low background, then 7 days of heavy sessions
    const base = Array.from({ length: 21 }, (_, i) => ({
      date: d(i + 7),
      rpe: 4,
      duration_min: 30,
    }));
    const spike = Array.from({ length: 7 }, (_, i) => ({
      date: d(i),
      rpe: 10,
      duration_min: 90,
    }));
    const result = calculateTrainingLoad([...base, ...spike], new Date("2026-06-04"));
    expect(result.acwr).toBeGreaterThan(1.3);
    expect(result.severity).toBe("severe");
  });

  it("flags undertraining when recent load drops", () => {
    const base = Array.from({ length: 21 }, (_, i) => ({
      date: d(i + 7),
      rpe: 8,
      duration_min: 60,
    }));
    // No sessions this week
    const result = calculateTrainingLoad(base, new Date("2026-06-04"));
    expect(result.acwr).toBeLessThan(0.8);
    expect(result.severity).toBe("warn");
  });
});

// ── Rule 5: High-RPE streak ───────────────────────────────────────────────────
describe("checkHighRPEStreak", () => {
  it("returns null if streak < 3", () => {
    const sessions = [
      { date: d(0), rpe: 9, duration_min: 60 },
      { date: d(1), rpe: 9, duration_min: 60 },
      { date: d(2), rpe: 5, duration_min: 60 },
    ];
    expect(checkHighRPEStreak(sessions)).toBeNull();
  });

  it("returns result for streak of 3+", () => {
    const sessions = [0, 1, 2].map((i) => ({ date: d(i), rpe: 9, duration_min: 60 }));
    const result = checkHighRPEStreak(sessions);
    expect(result).not.toBeNull();
    expect(result!.streakLength).toBe(3);
    expect(result!.avgRpe).toBe(9);
  });

  it("longer streak → severe severity", () => {
    const sessions = [0, 1, 2, 3, 4].map((i) => ({ date: d(i), rpe: 9, duration_min: 60 }));
    const result = checkHighRPEStreak(sessions);
    expect(result!.severity).toBe("severe");
  });
});

// ── Rule 6: Modality gaps ─────────────────────────────────────────────────────
describe("checkModalityGaps", () => {
  it("flags dryland gap > 7 days", () => {
    const oldDryland = [makeDryland({ date: d(10) })];
    const results = checkModalityGaps(oldDryland, [], new Date("2026-06-04"));
    const drylandGap = results.find((r) => r.modality === "dryland");
    expect(drylandGap).toBeDefined();
    expect(drylandGap!.daysSinceLastSession).toBe(10);
  });

  it("does not flag dryland within threshold", () => {
    const recent = [makeDryland({ date: d(3) })];
    const results = checkModalityGaps(recent, [], new Date("2026-06-04"));
    expect(results.find((r) => r.modality === "dryland")).toBeUndefined();
  });

  it("flags water gap > 14 days", () => {
    const oldWater = [makeWater({ date: d(20) })];
    const results = checkModalityGaps([], oldWater, new Date("2026-06-04"));
    const gap = results.find((r) => r.modality === "water");
    expect(gap).toBeDefined();
    expect(gap!.daysSinceLastSession).toBe(20);
  });
});

// ── Rule 7: Boat vs erg gap ───────────────────────────────────────────────────
describe("checkBoatErgGap", () => {
  it("returns null if either data is missing", () => {
    expect(checkBoatErgGap([], [])).toBeNull();
    expect(checkBoatErgGap([makeErg({ distance_m: 500 })], [])).toBeNull();
  });

  it("calculates gap correctly", () => {
    const erg = [makeErg({ distance_m: 500, split_sec: 130 })];
    const water = [makeWater({ distance_m: 500, avg_pace_sec: 155 })];
    const result = checkBoatErgGap(erg, water);
    expect(result!.gapSec).toBeCloseTo(25);
    expect(result!.ergSplitSec).toBe(130);
    expect(result!.waterSplitSec).toBe(155);
  });

  it("large gap → severe severity", () => {
    const erg = [makeErg({ distance_m: 500, split_sec: 120 })];
    const water = [makeWater({ distance_m: 500, avg_pace_sec: 160 })];
    const result = checkBoatErgGap(erg, water);
    expect(result!.gapSec).toBe(40);
    expect(result!.severity).toBe("severe");
  });

  it("small gap → ok severity", () => {
    const erg = [makeErg({ distance_m: 500, split_sec: 130 })];
    const water = [makeWater({ distance_m: 500, avg_pace_sec: 140 })];
    const result = checkBoatErgGap(erg, water);
    expect(result!.gapSec).toBe(10);
    expect(result!.severity).toBe("ok");
  });
});

// ── Training load / ACWR ─────────────────────────────────────────────────────

describe("calculateTrainingLoad", () => {
  const NOW = new Date(TODAY);
  const session = (daysAgo: number, rpe = 7, min = 60) => ({
    date: d(daysAgo), rpe, duration_min: min,
  });

  it("doesn't cry overtraining at an athlete with no history", () => {
    // Regression: dividing by a flat four weeks made chronic = acute / 4, so
    // ACWR came out at exactly 4.00 for every new athlete — well past the 1.3
    // "overreaching" ceiling — on their very first week.
    const r = calculateTrainingLoad([session(1), session(2), session(3)], NOW);
    expect(r.acwr).toBeLessThan(THRESHOLDS.acwrHigh);
    expect(r.severity).toBe("ok");
    expect(r.sufficientHistory).toBe(false);
  });

  it("gave the same 4.00 whatever the effort, which was the tell", () => {
    const hard = calculateTrainingLoad([session(1, 9, 120), session(2, 9, 120)], NOW);
    const easy = calculateTrainingLoad([session(1, 3, 20), session(2, 3, 20)], NOW);
    // Both are ~1.0 now; before, both were exactly 4.00 regardless of load.
    expect(hard.acwr).toBeLessThan(THRESHOLDS.acwrHigh);
    expect(easy.acwr).toBeLessThan(THRESHOLDS.acwrHigh);
  });

  it("reports a steady four-week athlete as balanced", () => {
    const sessions = [];
    for (let w = 0; w < 4; w++) for (const off of [1, 3, 5]) sessions.push(session(w * 7 + off));
    const r = calculateTrainingLoad(sessions, NOW);
    expect(r.sufficientHistory).toBe(true);
    expect(r.acwr).toBeGreaterThan(0.75);
    expect(r.acwr).toBeLessThan(1.3);
    expect(r.severity).toBe("ok");
  });

  it("still flags a genuine spike once there's a baseline to spike against", () => {
    const sessions = [];
    // Four weeks of light work...
    for (let w = 1; w < 5; w++) for (const off of [1, 3]) sessions.push(session(w * 7 + off, 4, 30));
    // ...then a very heavy current week.
    for (const off of [1, 2, 3, 4, 5]) sessions.push(session(off, 9, 150));
    const r = calculateTrainingLoad(sessions, NOW);
    expect(r.sufficientHistory).toBe(true);
    expect(r.acwr).toBeGreaterThan(THRESHOLDS.acwrHigh);
    expect(r.severity).toBe("severe");
  });

  it("still flags a drop-off once there's a baseline", () => {
    const sessions = [];
    for (let w = 1; w < 5; w++) for (const off of [1, 3, 5]) sessions.push(session(w * 7 + off, 8, 90));
    sessions.push(session(2, 3, 20)); // one easy session this week
    const r = calculateTrainingLoad(sessions, NOW);
    expect(r.acwr).toBeLessThan(THRESHOLDS.acwrLow);
    expect(r.severity).toBe("warn");
  });

  it("reports how much history it has to work with", () => {
    const r = calculateTrainingLoad([session(30), session(1)], NOW);
    expect(r.historyDays).toBe(30);
    expect(r.sufficientHistory).toBe(true);
  });

  it("handles an athlete with nothing logged", () => {
    const r = calculateTrainingLoad([], NOW);
    expect(Number.isFinite(r.acwr)).toBe(true);
    expect(r.severity).toBe("ok");
    expect(r.historyDays).toBe(0);
    expect(r.sufficientHistory).toBe(false);
  });
});

// ── Rule 8: PR proximity ─────────────────────────────────────────────────────
describe("checkPRProximity", () => {
  // Pinned so the fixtures don't age out of the 14-day window. Passing the
  // clock in is why this is stable; reading Date.now() inside made the test
  // pass in the week it was written and fail silently ever after.
  const NOW = new Date(TODAY);

  it("returns empty when no recent sessions", () => {
    const prs = [{ category: "erg" as const, distance_m: 500, time_sec: 120 }];
    expect(checkPRProximity([], [], prs, NOW)).toHaveLength(0);
  });

  it("flags proximity when recent session is close to PR", () => {
    const prs = [{ category: "erg" as const, distance_m: 500, time_sec: 130 }];
    // Recent session: split 131 → duration = 131s for 500m, 1s short of the PR.
    const erg = [makeErg({ date: d(3), distance_m: 500, duration_sec: 131, split_sec: 131 })];
    const result = checkPRProximity(erg, [], prs, NOW);
    expect(result.length).toBeGreaterThan(0);
    // Positive = still short of the PR, which is what templates.ts renders as
    // "within Xs of your PR". The old assertion had this inverted.
    expect(result[0].gapSec).toBeCloseTo(1, 0);
    expect(result[0].severity).toBe("warn");
  });

  it("ignores sessions older than the lookback window", () => {
    const prs = [{ category: "erg" as const, distance_m: 500, time_sec: 130 }];
    const erg = [makeErg({ date: d(30), distance_m: 500, duration_sec: 131, split_sec: 131 })];
    expect(checkPRProximity(erg, [], prs, NOW)).toHaveLength(0);
  });

  it("never emits NaN when the only sessions are at another distance", () => {
    const prs = [{ category: "erg" as const, distance_m: 500, time_sec: 130 }];
    const erg = [makeErg({ date: d(2), distance_m: 1000, duration_sec: 260, split_sec: 130 })];
    const result = checkPRProximity(erg, [], prs, NOW);
    expect(result).toHaveLength(0);
    for (const r of result) {
      expect(Number.isFinite(r.gapSec)).toBe(true);
      expect(Number.isFinite(r.recentTimeSec)).toBe(true);
    }
  });

  it("reports beating the PR as a negative gap, matching the copy", () => {
    const prs = [{ category: "erg" as const, distance_m: 500, time_sec: 130 }];
    const erg = [makeErg({ date: d(1), distance_m: 500, duration_sec: 126, split_sec: 126 })];
    const [result] = checkPRProximity(erg, [], prs, NOW);
    expect(result).toBeDefined();
    // templates.ts renders gapSec <= 0 as "New PR! Beat old best by 4.0s".
    expect(result.gapSec).toBeCloseTo(-4, 0);
    expect(result.severity).toBe("ok");
  });

  it("scales split to total time for distances other than 500m", () => {
    const prs = [{ category: "erg" as const, distance_m: 2000, time_sec: 520 }];
    // 130s per 500m over 2000m => 520s total, exactly on the PR.
    const erg = [makeErg({ date: d(2), distance_m: 2000, duration_sec: 520, split_sec: 130 })];
    const [result] = checkPRProximity(erg, [], prs, NOW);
    expect(result).toBeDefined();
    expect(result.recentTimeSec).toBeCloseTo(520, 0);
    expect(result.gapSec).toBeCloseTo(0, 0);
  });
});

// ── PR trend ─────────────────────────────────────────────────────────────────
describe("computePRTrend", () => {
  it("returns null with fewer than 2 sessions at distance", () => {
    expect(computePRTrend([makeErg({ distance_m: 2000 })], 2000)).toBeNull();
    expect(computePRTrend([], 2000)).toBeNull();
  });

  it("detects improvement when later sessions are faster", () => {
    const sessions = [
      makeErg({ date: d(20), distance_m: 2000, split_sec: 138 }),
      makeErg({ date: d(15), distance_m: 2000, split_sec: 135 }),
      makeErg({ date: d(10), distance_m: 2000, split_sec: 133 }),
      makeErg({ date: d(5),  distance_m: 2000, split_sec: 130 }),
    ];
    const result = computePRTrend(sessions, 2000);
    expect(result!.improvementSec).toBeGreaterThan(0);
  });

  it("detects plateau when splits are flat", () => {
    const sessions = [130, 130, 131, 130].map((split_sec, i) =>
      makeErg({ date: d(i * 5 + 5), distance_m: 2000, split_sec })
    );
    const result = computePRTrend(sessions, 2000);
    expect(Math.abs(result!.improvementSec)).toBeLessThan(1);
  });
});

describe("the split-fade copy", () => {
  it("names the distance the splits actually came from", async () => {
    // Was hardcoded to "2k" whatever the piece was.
    const { insightTitle } = await import("../templates");
    const oneK = checkSplitFade([
      makeErg({ distance_m: 1000, split_sec: 120, segment_splits: [118, 126] }),
    ])!;
    expect(oneK.distanceM).toBe(1000);
    expect(insightTitle(oneK)).toContain("1k");
    expect(insightTitle(oneK)).not.toContain("2k");
  });

  it("reports the fade it measured, not a fixed number", async () => {
    const { insightTitle } = await import("../templates");
    const result = checkSplitFade([
      makeErg({ distance_m: 2000, split_sec: 125, segment_splits: [118, 122, 125, 131] }),
    ])!;
    expect(insightTitle(result)).toContain("13.0s");
  });
});
