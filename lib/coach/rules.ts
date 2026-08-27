/**
 * Pure, side-effect-free coaching rule functions.
 * Each takes raw session data and returns a typed result (or null if not applicable).
 *
 * These are the only functions that produce coaching output — no LLM, no API.
 */

import { THRESHOLDS } from "./thresholds";
import { toLocalDateStr, daysBefore } from "@/lib/utils";
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
  /** Seconds per 500m for each recorded segment, in order. Optional. */
  segment_splits?: number[];
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

// ── Rule 1: Split fade (within a single timed erg) ────────────────────────────
/**
 * How much the athlete slows across a timed piece, measured from the splits
 * they actually recorded.
 *
 * This used to invent the segments. Given only an overall split it produced
 * [split-2, split-1, split+1, split+2] from a "typical 3% fade model", so the
 * fade was arithmetically always exactly 4.0s — every athlete was told their
 * 2k faded 4.0s in the final 500m, and then given a paragraph of pacing advice
 * about their anaerobic reserves, on the basis of no evidence whatsoever. A
 * diagnosis the app cannot support is worse than no diagnosis: the athlete
 * can act on it.
 *
 * It now requires real per-segment splits and returns null without them, so
 * the coach stays quiet until there is something to say.
 */
export function checkSplitFade(
  ergSessions: ErgSessionInput[],
): SplitFadeResult | null {
  // Only sessions where the athlete recorded each 500m, newest first. Two
  // segments is the minimum that can show a fade at all.
  const withSplits = ergSessions
    .filter((s) => Array.isArray(s.segment_splits) && s.segment_splits.length >= 2)
    .filter((s) => s.segment_splits!.every((v) => typeof v === "number" && v > 0))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (withSplits.length === 0) return null;

  const latest = withSplits[0];
  const segments = latest.segment_splits!;

  // Compared against the opening segment, which is what "fade" means — not
  // against the fastest, or a piece with a quick third 500 would report a
  // fade it didn't have.
  const first = segments[0];
  let worstIndex = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i] > segments[worstIndex]) worstIndex = i;
  }
  const fadeSec = segments[worstIndex] - first;

  // A negative split is the opposite of fade and shouldn't be reported as one.
  if (fadeSec <= 0) return null;

  const labels = segments.map((_, i) => `${i * 500}–${(i + 1) * 500}m`);

  return {
    kind: "split-fade",
    severity: severity(fadeSec, THRESHOLDS.splitFadeWarnSec, THRESHOLDS.splitFadeSevereSec),
    distanceM: latest.distance_m,
    segmentLabels: labels,
    splitsSec: segments,
    fadeSec,
    fadingSegment: labels[worstIndex],
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

  // Acute = 7-day sum; chronic = weekly average over the 28-day window.
  const acuteFrom = toLocalDateStr(daysBefore(now, 6));
  const chronicFrom = toLocalDateStr(daysBefore(now, 27));

  const acuteLoad = withLoad
    .filter((s) => s.date >= acuteFrom)
    .reduce((sum, s) => sum + s.load, 0);

  const chronicSessions = withLoad.filter((s) => s.date >= chronicFrom);

  // How long this athlete has actually been logging. Dividing by a flat four
  // weeks when they have three days of history made the chronic baseline a
  // quarter of the acute load, so ACWR came out at exactly 4.00 for every new
  // athlete regardless of how little they had done — and 4.00 reads as a
  // severe overtraining warning on their first week.
  const earliest = withLoad.map((s) => s.date).sort()[0];
  const historyDays = earliest ? daysSince(earliest, now) : 0;
  const weeksCovered = Math.min(4, Math.max(1, historyDays / 7));

  const chronicLoad = chronicSessions.reduce((sum, s) => sum + s.load, 0) / weeksCovered;
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

  // Even with the divisor fixed, the ratio doesn't mean much until there's a
  // real base to compare against, so hold off on advice rather than guessing.
  const sufficientHistory = historyDays >= THRESHOLDS.acwrMinHistoryDays;

  let sev: Severity = "ok";
  if (sufficientHistory) {
    if (acwr > THRESHOLDS.acwrHigh) sev = "severe";
    else if (acwr < THRESHOLDS.acwrLow) sev = "warn";
  }

  return {
    kind: "training-load",
    acwr: Math.round(acwr * 100) / 100,
    severity: sev,
    weeklyLoadSRPE: Math.round(acuteLoad),
    monthlyAvgSRPE: Math.round(chronicLoad),
    historyDays,
    sufficientHistory,
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
  /** Date of the athlete's first session of any kind, if they have one. */
  firstSessionDate?: string,
): ModalityGapResult[] {
  const results: ModalityGapResult[] = [];

  // Someone who started on Monday has not "gone 999 days without dryland" —
  // they have been here three days. Reporting a gap shorter than the athlete's
  // own history tells a beginner their first week is already going wrong, and
  // it was doing exactly that: with no dryland sessions the rule reported a
  // 999-day gap and made it the focus of their week.
  const historyDays = firstSessionDate ? daysSince(firstSessionDate, now) : 0;

  const latestDryland = drylandSessions
    .map((s) => s.date)
    .sort()
    .at(-1);
  const latestWater = waterSessions
    .map((s) => s.date)
    .sort()
    .at(-1);

  if (historyDays >= THRESHOLDS.drylandGapDays &&
      (!latestDryland || daysSince(latestDryland, now) >= THRESHOLDS.drylandGapDays)) {
    const days = latestDryland ? daysSince(latestDryland, now) : 999;
    results.push({
      kind: "modality-gap",
      severity: days >= THRESHOLDS.drylandGapDays * 2 ? "severe" : "warn",
      modality: "dryland",
      daysSinceLastSession: days,
      threshold: THRESHOLDS.drylandGapDays,
    });
  }

  if (historyDays >= THRESHOLDS.waterGapDays &&
      (!latestWater || daysSince(latestWater, now) >= THRESHOLDS.waterGapDays)) {
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

    // A gap of zero means the athlete's best recent session *is* the one that
    // set this record — the usual case, since a PR is created from a session.
    // Reported as a beaten PR it produced "New 500m PR! Beat old best by
    // 0.0s", three times over on the sample data. Equalling your own record
    // isn't beating it, and there is nothing here the Records page doesn't
    // already show. The tolerance covers times stored with sub-second
    // precision, where the subtraction won't land exactly on zero.
    if (Math.abs(gap) < 0.05) continue;

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
