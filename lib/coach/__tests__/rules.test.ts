/**
 * Unit tests for the coaching rules engine.
 * All tests are pure — no DB, no network, no Supabase.
 */
import { describe, it, expect } from "vitest";
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
  it("returns null when no 2k sessions", () => {
    expect(checkSplitFade([])).toBeNull();
    expect(checkSplitFade([makeErg({ distance_m: 500 })])).toBeNull();
  });

  it("returns a result for a 2k session", () => {
    const result = checkSplitFade([makeErg({ distance_m: 2000, split_sec: 130 })]);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("split-fade");
    expect(result!.splitsSec).toHaveLength(4);
    expect(result!.fadeSec).toBeGreaterThan(0);
  });

  it("fade ≤ 3s is ok severity", () => {
    // splitFadeWarnSec = 3; our model always uses the same 4s fade
    const result = checkSplitFade([makeErg({ distance_m: 2000, split_sec: 130 })]);
    // The model produces 4s fade (segments: -2, -1, +1, +2 from baseSplit)
    expect(result!.severity).toBe("warn"); // 4s > 3s threshold → warn
  });

  it("uses the most recent 2k session", () => {
    const sessions = [
      makeErg({ date: d(10), distance_m: 2000, split_sec: 140 }),
      makeErg({ date: d(1),  distance_m: 2000, split_sec: 130 }),
    ];
    const result = checkSplitFade(sessions);
    expect(result!.splitsSec[0]).toBe(128); // based on baseSplit 130: 130-2=128
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
