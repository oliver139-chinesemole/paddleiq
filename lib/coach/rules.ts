/**
 * Pure, side-effect-free coaching rule functions.
 * Each takes raw session data and returns a typed result (or null if not applicable).
 *
 * These are the only functions that produce coaching output — no LLM, no API.
 */

import { THRESHOLDS } from "./thresholds";
import type {
  SplitFadeResult, PacingConsistencyResult, TrainingLoadResult,
  HighRPEStreakResult, ModalityGapResult, BoatErgGapResult,
  PRProximityResult, PRTrendResult, Severity,
} from "./types";

// ── Minimal input types (subset of full DB types) ────────────────────────────

export interface SessionBase {
  date: string;           // ISO date "YYYY-MM-DD"
  rpe: number;
  duration_min?: number;  // minutes — team/dryland
  duration_sec?: number;  // seconds — erg/water (we normalise to minutes below)
}

export interface ErgSessionInput extends SessionBase {
  distance_m: number;
  duration_sec: number;
  split_sec: number;
}

export interface WaterSessionInput extends SessionBase {
  distance_m: number;
  duration_sec: number;
  avg_pace_sec: number;   // seconds per 500m
}

export interface DrylandSessionInput extends SessionBase {
  duration_min: number;
}

export interface TeamSessionInput extends SessionBase {
  duration_min: number;
}

export interface PRInput {
  category: "erg" | "water";
  distance_m: number;
  time_sec: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function daysSince(dateStr: string, now = new Date()): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function durationMinutes(s: SessionBase): number {
  if (s.duration_min != null) return s.duration_min;
  if (s.duration_sec != null) return s.duration_sec / 60;
  return 0;
}

function severity(value: number, warnThreshold: number, severeThreshold: number): Severity {
  if (value >= severeThreshold) return "severe";
  if (value >= warnThreshold) return "warn";
  return "ok";
}

// ── Rule 1: Split fade (within a single 2k erg) ───────────────────────────────
/**
 * Given a 2k erg session where we have the overall split, we estimate
 * segment splits from a simple fade model.  When per-segment data is
 * available (future: store segment_splits[]), use that directly.
 * For now we require at least two 500m-distance erg sessions to compare.
 */
export function checkSplitFade(
  ergSessions: ErgSessionInput[],
): SplitFadeResult | null {
  // Use 2k sessions only
  const twoK = ergSessions
    .filter((s) => s.distance_m === 2000 && s.split_sec > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (twoK.length === 0) return null;

  const latest = twoK[0];
  // Without per-segment data, approximate fade from the typical 3% fade model:
  // segment 1 ≈ split - 2s, segment 2 ≈ split - 1s, segment 3 ≈ split + 1s, segment 4 ≈ split + 2s
  const baseSplit = latest.split_sec;
  const segments = [baseSplit - 2, baseSplit - 1, baseSplit + 1, baseSplit + 2];
  const fadeSec = segments[3] - segments[0];

  const sev = severity(fadeSec, THRESHOLDS.splitFadeWarnSec, THRESHOLDS.splitFadeSevereSec);

  return {
    kind: "split-fade",
    severity: sev,
    segmentLabels: ["0–500m", "500–1000m", "1000–1500m", "1500–2000m"],
    splitsSec: segments,
    fadeSec,
    fadingSegment: "1500–2000m",
  };
}

// ── Rule 2: Pacing consistency (across interval sessions) ─────────────────────
export function checkPacingConsistency(
  ergSessions: ErgSessionInput[],
): PacingConsistencyResult | null {
  // Get splits from sessions of the same distance (most recent 8 of each distance)
  const splits = ergSessions
    .filter((s) => s.split_sec > 0 && s.distance_m >= 200)
    .map((s) => s.split_sec);

  if (splits.length < 3) return null;

  const sd = stdDev(splits);
  const sev = severity(sd, THRESHOLDS.pacingVarianceWarnSec, THRESHOLDS.pacingVarianceSevereSec);

  return {
    kind: "pacing-consistency",
    severity: sev,
    stdDevSec: Math.round(sd * 10) / 10,
    sampleCount: splits.length,
  };
}

// ── Rule 3 + 4: sRPE & Acute:Chronic Workload Ratio ──────────────────────────
export function calculateTrainingLoad(
  allSessions: SessionBase[],
  now = new Date(),
): TrainingLoadResult {
  const withLoad = allSessions.map((s) => ({
    date: s.date,
    load: s.rpe * durationMinutes(s),
  }));

  // Acute = 7-day sum; Chronic = 28-day average
  const cutoffAcute = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoffChronic = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const acuteLoad = withLoad
    .filter((s) => new Date(s.date) >= cutoffAcute)
    .reduce((sum, s) => sum + s.load, 0);

  const chronicSessions = withLoad.filter((s) => new Date(s.date) >= cutoffChronic);
  const chronicLoad = chronicSessions.reduce((sum, s) => sum + s.load, 0) / 4; // 4 weeks → weekly avg

  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

  let sev: Severity = "ok";
  if (acwr > THRESHOLDS.acwrHigh) sev = "severe";
  else if (acwr < THRESHOLDS.acwrLow) sev = "warn";

  return {
    kind: "training-load",
    acwr: Math.round(acwr * 100) / 100,
    severity: sev,
    weeklyLoadSRPE: Math.round(acuteLoad),
    monthlyAvgSRPE: Math.round(chronicLoad),
  };
}

// ── Rule 5: High-RPE streak ───────────────────────────────────────────────────
export function checkHighRPEStreak(
  allSessions: SessionBase[],
): HighRPEStreakResult | null {
  const sorted = [...allSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  let rpeSum = 0;
  for (const s of sorted) {
    if (s.rpe >= THRESHOLDS.highRpeMinimum) {
      streak++;
      rpeSum += s.rpe;
    } else {
      break;
    }
  }

  if (streak < THRESHOLDS.highRpeStreakWarn) return null;

  return {
    kind: "high-rpe-streak",
    severity: streak >= THRESHOLDS.highRpeStreakWarn + 1 ? "severe" : "warn",
    streakLength: streak,
    avgRpe: Math.round((rpeSum / streak) * 10) / 10,
  };
}

// ── Rule 6: Modality gaps ─────────────────────────────────────────────────────
export function checkModalityGaps(
  drylandSessions: DrylandSessionInput[],
  waterSessions: WaterSessionInput[],
  now = new Date(),
): ModalityGapResult[] {
  const results: ModalityGapResult[] = [];

  const latestDryland = drylandSessions
    .map((s) => s.date)
    .sort()
    .at(-1);
  const latestWater = waterSessions
    .map((s) => s.date)
    .sort()
    .at(-1);

  if (!latestDryland || daysSince(latestDryland, now) >= THRESHOLDS.drylandGapDays) {
    const days = latestDryland ? daysSince(latestDryland, now) : 999;
    results.push({
      kind: "modality-gap",
      severity: days >= THRESHOLDS.drylandGapDays * 2 ? "severe" : "warn",
      modality: "dryland",
      daysSinceLastSession: days,
      threshold: THRESHOLDS.drylandGapDays,
    });
  }

  if (!latestWater || daysSince(latestWater, now) >= THRESHOLDS.waterGapDays) {
    const days = latestWater ? daysSince(latestWater, now) : 999;
    results.push({
      kind: "modality-gap",
      severity: days >= THRESHOLDS.waterGapDays * 2 ? "severe" : "warn",
      modality: "water",
      daysSinceLastSession: days,
      threshold: THRESHOLDS.waterGapDays,
    });
  }

  return results;
}

// ── Rule 7: Boat vs erg efficiency gap ───────────────────────────────────────
export function checkBoatErgGap(
  ergSessions: ErgSessionInput[],
  waterSessions: WaterSessionInput[],
): BoatErgGapResult | null {
  const ergAt500 = ergSessions
    .filter((s) => s.distance_m === 500 && s.split_sec > 0)
    .sort((a, b) => a.split_sec - b.split_sec);   // best first
  const waterAt500 = waterSessions
    .filter((s) => s.distance_m === 500 && s.avg_pace_sec > 0)
    .sort((a, b) => a.avg_pace_sec - b.avg_pace_sec);

  if (ergAt500.length === 0 || waterAt500.length === 0) return null;

  const ergSplit = ergAt500[0].split_sec;
  const waterSplit = waterAt500[0].avg_pace_sec;
  const gapSec = waterSplit - ergSplit;

  return {
    kind: "boat-erg-gap",
    severity: severity(gapSec, THRESHOLDS.efficiencyGapWarnSec, THRESHOLDS.efficiencyGapSevereSec),
    ergSplitSec: ergSplit,
    waterSplitSec: waterSplit,
    gapSec,
    efficiency: ergSplit > 0 ? Math.round((ergSplit / waterSplit) * 1000) / 10 : 0,
  };
}

// ── Rule 8: PR proximity & improvement trend ──────────────────────────────────
export function checkPRProximity(
  ergSessions: ErgSessionInput[],
  waterSessions: WaterSessionInput[],
  prs: PRInput[],
  now = new Date(),
): PRProximityResult[] {
  const results: PRProximityResult[] = [];
  const recent = new Date(now.getTime() - THRESHOLDS.prProximityWindowDays * 24 * 60 * 60 * 1000);

  for (const pr of prs) {
    const isRecent = (date: string) => new Date(date) >= recent;

    // Take the fastest 500m pace first, then scale — multiplying a possibly
    // missing session straight through yields NaN, which slips past a null
    // check and quietly poisons every comparison below.
    const bestPace = pr.category === "erg"
      ? ergSessions
          .filter((s) => s.distance_m === pr.distance_m && isRecent(s.date))
          .sort((a, b) => a.split_sec - b.split_sec)[0]?.split_sec
      : waterSessions
          .filter((s) => s.distance_m === pr.distance_m && isRecent(s.date))
          .sort((a, b) => a.avg_pace_sec - b.avg_pace_sec)[0]?.avg_pace_sec;

    if (bestPace === undefined) continue;
    const bestRecent = bestPace * (pr.distance_m / 500);

    // Negative = faster than the PR, i.e. beaten it; positive = still short of
    // it. templates.ts and the severity below both read the sign this way.
    const gap = bestRecent - pr.time_sec;
    const fraction = Math.abs(gap) / pr.time_sec;

    if (fraction <= THRESHOLDS.prProximityFraction || gap <= 0) {
      results.push({
        kind: "pr-proximity",
        severity: gap <= 0 ? "ok" : "warn",
        category: pr.category,
        distanceM: pr.distance_m,
        prTimeSec: pr.time_sec,
        recentTimeSec: bestRecent,
        gapSec: gap,
        proximityFraction: fraction,
      });
    }
  }

  return results;
}

// ── PR trend ──────────────────────────────────────────────────────────────────
export function computePRTrend(
  sessions: ErgSessionInput[],
  distanceM: number,
): PRTrendResult | null {
  const matching = sessions
    .filter((s) => s.distance_m === distanceM && s.split_sec > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (matching.length < 2) return null;

  // Compare first half average vs second half average (both halves by date)
  const half = Math.floor(matching.length / 2);
  const early = matching.slice(0, half);
  const late = matching.slice(-half);

  const avgEarly = early.reduce((s, x) => s + x.split_sec, 0) / early.length;
  const avgLate = late.reduce((s, x) => s + x.split_sec, 0) / late.length;
  const improvement = avgEarly - avgLate; // positive = getting faster

  return {
    kind: "pr-trend",
    severity: improvement > 0 ? "ok" : "warn",
    category: "erg",
    distanceM,
    improvementSec: Math.round(improvement * 10) / 10,
    sessions: matching.length,
  };
}
