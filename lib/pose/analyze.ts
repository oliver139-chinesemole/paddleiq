// Pure stroke analysis. No DOM, no MediaPipe — takes landmark frames in,
// returns measurements out, so all of this is unit-testable.
//
// Everything spatial is expressed in *torso units* (one torso = shoulder-to-hip
// distance) rather than pixels. Camera distance and resolution then drop out,
// which is what makes two recordings comparable at all.
//
// Important limitation: these are 2D image-space measurements from a single
// camera. They describe the paddler *relative to their own other strokes*, not
// against some absolute biomechanical truth. Rotation in particular is a proxy
// (see shoulderSpread) and is only meaningful from a roughly side-on view.

import {
  LM,
  isVisible,
  bottomWrist,
  topWrist,
  shoulderFor,
  hipFor,
  type PoseFrame,
  type Point,
  type PaddleSide,
} from "./landmarks";

// ─── tunables ────────────────────────────────────────────────────────────────

/** Fastest plausible dragon boat cadence. Anything above this is noise. */
const MAX_SPM = 110;
/** Slowest cadence we still treat as "paddling" rather than drifting. */
const MIN_SPM = 20;
const MIN_PERIOD_MS = 60_000 / MAX_SPM;
const MAX_PERIOD_MS = 60_000 / MIN_SPM;

/** Cycles whose drive amplitude is below this (in torso units) are discarded. */
const MIN_AMPLITUDE = 0.15;
/** Need at least this many clean strokes before reporting anything. */
export const MIN_STROKES = 4;
/** Fraction of frames that must have a usable pose for the clip to be analyzable. */
const MIN_USABLE_FRACTION = 0.5;

// ─── small numeric helpers ───────────────────────────────────────────────────

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * Coefficient of variation as a percentage — std as a share of the mean.
 * Scale-free, so it compares cleanly across paddlers and camera setups.
 */
export function coefficientOfVariation(xs: number[]): number {
  const m = mean(xs);
  if (Math.abs(m) < 1e-9) return 0;
  return (stdDev(xs) / Math.abs(m)) * 100;
}

/** Centered moving average. Odd window sizes keep the signal in phase. */
export function smooth(xs: number[], window = 5): number[] {
  if (window <= 1 || xs.length === 0) return [...xs];
  const half = Math.floor(window / 2);
  return xs.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(xs.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += xs[j];
    return sum / (hi - lo + 1);
  });
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ─── per-frame geometry ──────────────────────────────────────────────────────

/** Shoulder-to-hip distance, averaged over both sides where visible. */
export function torsoLength(lms: Point[]): number | null {
  const pairs: Array<[number, number]> = [
    [LM.LEFT_SHOULDER, LM.LEFT_HIP],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  ];
  const lens = pairs
    .filter(([s, h]) => isVisible(lms[s]) && isVisible(lms[h]))
    .map(([s, h]) => dist(lms[s], lms[h]));
  if (!lens.length) return null;
  const t = mean(lens);
  return t > 1e-4 ? t : null;
}

/**
 * Horizontal gap between the shoulders, in torso units.
 *
 * From a side-on camera a square torso projects both shoulders to nearly the
 * same x (small spread); winding up for the catch swings the shoulder line
 * toward the camera axis and opens that gap. So spread rises and falls with
 * rotation. It is a *proxy*: it degrades as the camera moves off-axis, which is
 * why we report the catch-to-exit range rather than any absolute angle.
 */
export function shoulderSpread(lms: Point[], torso: number): number | null {
  const l = lms[LM.LEFT_SHOULDER];
  const r = lms[LM.RIGHT_SHOULDER];
  if (!isVisible(l) || !isVisible(r) || torso <= 0) return null;
  return Math.abs(l.x - r.x) / torso;
}

// ─── stroke segmentation ─────────────────────────────────────────────────────

export interface Stroke {
  /** Index into the frame array where the blade enters (most forward reach). */
  catchIdx: number;
  /** Index where the blade leaves the water (most rearward). */
  exitIdx: number;
  catchTMs: number;
  exitTMs: number;
  /** Forward-to-back travel of the driving wrist, in torso units. */
  amplitude: number;
}

/**
 * Splits a drive signal into individual strokes.
 *
 * Rather than picking peaks directly — fragile on noisy quasi-periodic data —
 * we center the signal and cut it at upward mean-crossings, then take the max
 * (catch) and min (exit) inside each cycle.
 */
export function segmentStrokes(drive: number[], times: number[]): Stroke[] {
  if (drive.length < 4 || drive.length !== times.length) return [];

  const centered = drive.map((v) => v - mean(drive));

  // Cycle boundaries: every point where the signal crosses zero going up.
  const crossings: number[] = [];
  for (let i = 1; i < centered.length; i++) {
    if (centered[i - 1] <= 0 && centered[i] > 0) crossings.push(i);
  }
  if (crossings.length < 2) return [];

  const strokes: Stroke[] = [];
  for (let c = 0; c < crossings.length - 1; c++) {
    const start = crossings[c];
    const end = crossings[c + 1];
    const periodMs = times[end] - times[start];
    if (periodMs < MIN_PERIOD_MS || periodMs > MAX_PERIOD_MS) continue;

    let catchIdx = start;
    let exitIdx = start;
    for (let i = start; i <= end; i++) {
      if (drive[i] > drive[catchIdx]) catchIdx = i;
      if (drive[i] < drive[exitIdx]) exitIdx = i;
    }

    const amplitude = drive[catchIdx] - drive[exitIdx];
    if (amplitude < MIN_AMPLITUDE) continue;
    // The blade must leave the water after it enters it.
    if (exitIdx <= catchIdx) continue;

    strokes.push({
      catchIdx,
      exitIdx,
      catchTMs: times[catchIdx],
      exitTMs: times[exitIdx],
      amplitude,
    });
  }
  return strokes;
}

// ─── results ─────────────────────────────────────────────────────────────────

export interface StrokeMetrics {
  strokeCount: number;
  /** Cadence in strokes per minute, from the median catch-to-catch interval. */
  strokeRateSpm: number;
  /** Median forward reach at the catch, in torso units. */
  reach: number;
  /** Median forward-to-back travel of the driving wrist, in torso units. */
  strokeLength: number;
  /**
   * Median catch-to-exit change in shoulder spread — the rotation proxy.
   * Null when the shoulders were not reliably visible.
   */
  rotationRange: number | null;
  /**
   * Median height of the top wrist above the shoulder, in torso units.
   * Positive means the top hand stays high, which is what you want.
   */
  topArmHeight: number | null;
  /** Spread of catch-to-catch timing, as a percentage. Lower is tighter. */
  timingVariationPct: number;
  /** Spread of reach across strokes, as a percentage. Lower is more repeatable. */
  reachVariationPct: number;
  /** Share of sampled frames that yielded a usable pose, 0..1. */
  poseQuality: number;
}

export type AnalysisResult =
  | { ok: true; metrics: StrokeMetrics; strokes: Stroke[] }
  | { ok: false; reason: AnalysisFailure };

export type AnalysisFailure =
  | "no-frames"
  | "no-pose"
  | "too-short"
  | "no-strokes";

export const FAILURE_MESSAGES: Record<AnalysisFailure, string> = {
  "no-frames": "No frames were captured. Try recording again.",
  "no-pose":
    "Couldn't see a paddler for most of the clip. Make sure your whole upper body is in frame and well lit.",
  "too-short": "Clip is too short — record at least 10 seconds of steady paddling.",
  "no-strokes": `Couldn't find at least ${MIN_STROKES} clean strokes. Film side-on and paddle continuously.`,
};

/**
 * Turns a sequence of pose frames into stroke measurements.
 *
 * `side` is the paddler's paddling side, which selects the driving wrist.
 */
export function analyzeStrokes(frames: PoseFrame[], side: PaddleSide): AnalysisResult {
  if (!frames.length) return { ok: false, reason: "no-frames" };

  const bwIdx = bottomWrist(side);
  const twIdx = topWrist(side);
  const shIdx = shoulderFor(side);
  const hipIdx = hipFor(side);

  // Keep only frames where the pose is trustworthy enough to measure.
  const usable = frames.filter((f) => {
    const t = torsoLength(f.landmarks);
    return t !== null && isVisible(f.landmarks[bwIdx]) && isVisible(f.landmarks[hipIdx]);
  });

  if (usable.length / frames.length < MIN_USABLE_FRACTION || usable.length < 4) {
    return { ok: false, reason: "no-pose" };
  }

  const spanMs = usable[usable.length - 1].tMs - usable[0].tMs;
  if (spanMs < 3_000) return { ok: false, reason: "too-short" };

  const times = usable.map((f) => f.tMs);
  const torsos = usable.map((f) => torsoLength(f.landmarks) as number);

  // Drive signal: how far forward of the hip the working wrist sits.
  // Positive = reaching toward the bow. Image x grows rightward, so a paddler
  // facing left needs the sign flipped; we take the absolute offset per frame
  // and let segmentation work on the resulting oscillation either way.
  const driveRaw = usable.map((f, i) => {
    const w = f.landmarks[bwIdx];
    const h = f.landmarks[hipIdx];
    return (h.x - w.x) / torsos[i];
  });

  // If the paddler faces the other way the signal is inverted; flipping it so
  // the catch is always the maximum keeps downstream logic direction-agnostic.
  const oriented = Math.abs(Math.min(...driveRaw)) > Math.abs(Math.max(...driveRaw))
    ? driveRaw.map((v) => -v)
    : driveRaw;

  const drive = smooth(oriented, 5);
  const strokes = segmentStrokes(drive, times);
  if (strokes.length < MIN_STROKES) return { ok: false, reason: "no-strokes" };

  // Cadence from catch-to-catch intervals.
  const periods: number[] = [];
  for (let i = 1; i < strokes.length; i++) {
    periods.push(strokes[i].catchTMs - strokes[i - 1].catchTMs);
  }
  const medPeriod = median(periods);
  const strokeRateSpm = medPeriod > 0 ? 60_000 / medPeriod : 0;

  const reaches = strokes.map((s) => drive[s.catchIdx]);
  const lengths = strokes.map((s) => s.amplitude);

  // Rotation proxy: how much shoulder spread opens between catch and exit.
  const rotations: number[] = [];
  for (const s of strokes) {
    const atCatch = shoulderSpread(usable[s.catchIdx].landmarks, torsos[s.catchIdx]);
    const atExit = shoulderSpread(usable[s.exitIdx].landmarks, torsos[s.exitIdx]);
    if (atCatch !== null && atExit !== null) rotations.push(Math.abs(atCatch - atExit));
  }

  // Top arm height at the catch — is the top hand stacked above the shoulder?
  const topHeights: number[] = [];
  for (const s of strokes) {
    const f = usable[s.catchIdx];
    const tw = f.landmarks[twIdx];
    const sh = f.landmarks[shIdx];
    if (isVisible(tw) && isVisible(sh)) {
      // Image y grows downward, so shoulder-minus-wrist is positive when the
      // hand is above the shoulder.
      topHeights.push((sh.y - tw.y) / torsos[s.catchIdx]);
    }
  }

  return {
    ok: true,
    strokes,
    metrics: {
      strokeCount: strokes.length,
      strokeRateSpm,
      reach: median(reaches),
      strokeLength: median(lengths),
      rotationRange: rotations.length ? median(rotations) : null,
      topArmHeight: topHeights.length ? median(topHeights) : null,
      timingVariationPct: coefficientOfVariation(periods),
      reachVariationPct: coefficientOfVariation(reaches),
      poseQuality: usable.length / frames.length,
    },
  };
}
