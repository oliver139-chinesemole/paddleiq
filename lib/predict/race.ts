/**
 * Predicting a race time at one distance from a personal record at another.
 *
 * The standard model is Riegel's: T2 = T1 × (D2/D1)^k. For running k ≈ 1.06,
 * and it happens to land in the right place for the paddle erg too — with
 * k = 1.06, doubling the distance adds about 5 seconds to the 500m split,
 * which is the rule of thumb ("Paul's Law") coaches already use. So the
 * default isn't borrowed from a different sport by accident; it reproduces
 * the heuristic the sport arrived at independently.
 *
 * The more interesting number is the athlete's *own* exponent, fitted from
 * their PRs by regressing log(time) on log(distance). k below 1.06 means they
 * hold pace better than typical as distance grows — an endurance profile. k
 * above it means they fade — a sprinter's profile. That single number says
 * something about what to train that no individual PR does.
 *
 * Everything here is pure, so it's testable and runs the same on the server.
 */

/** Riegel's exponent for the paddle erg, matching the 5s-per-double rule. */
export const DEFAULT_EXPONENT = 1.06;

/** Below this many PRs a fitted exponent is noise; use the default instead. */
const MIN_POINTS_TO_FIT = 3;

/** A fit this loose means the PRs disagree; don't pretend it's personalised. */
const MIN_R2_TO_TRUST = 0.9;

/**
 * A fitted exponent outside this range is a data-entry error, not a physiology
 * finding — a mistyped time can produce k = 0.4 or k = 3, and predicting from
 * that would be worse than the generic model.
 */
const PLAUSIBLE_EXPONENT = { min: 0.9, max: 1.3 };

export interface RacePoint {
  distance_m: number;
  time_sec: number;
}

export interface EnduranceProfile {
  /** Fitted Riegel exponent, or DEFAULT_EXPONENT when there's too little data. */
  exponent: number;
  /** True when the exponent came from the athlete's own PRs. */
  fitted: boolean;
  /** Goodness of fit, 0–1. Undefined when not fitted. */
  r2?: number;
  /** How many PRs went into the fit. */
  points: number;
  /** Which way the athlete leans, relative to the typical exponent. */
  lean: "endurance" | "balanced" | "speed";
}

export type Confidence = "high" | "moderate" | "rough";

export interface Prediction {
  distance_m: number;
  /** Predicted time in seconds. */
  time_sec: number;
  /** Pace per 500m, the unit athletes actually compare. */
  split_sec: number;
  /** The PR this was extrapolated from. */
  from: RacePoint;
  confidence: Confidence;
}

/**
 * Predict the time at `target` from a single known result.
 *
 * Returns null for inputs that can't produce a meaningful answer rather than
 * NaN or Infinity, which would render as "NaN:aN" somewhere downstream.
 */
export function predictTime(
  known: RacePoint,
  targetDistance_m: number,
  exponent: number = DEFAULT_EXPONENT,
): number | null {
  if (!(known.distance_m > 0) || !(known.time_sec > 0)) return null;
  if (!(targetDistance_m > 0)) return null;
  if (!Number.isFinite(exponent) || exponent <= 0) return null;

  const predicted = known.time_sec * Math.pow(targetDistance_m / known.distance_m, exponent);
  return Number.isFinite(predicted) ? Math.round(predicted) : null;
}

/**
 * How much to trust an extrapolation, based on how far it reaches.
 *
 * Riegel holds well near the anchor and degrades as the ratio grows — a 500m
 * PR says very little about a 5k. The thresholds are deliberately conservative
 * because an over-confident prediction is worse than an honestly vague one:
 * an athlete who trains for a number they were never going to hit blames
 * themselves, not the model.
 */
export function confidenceFor(fromDistance_m: number, toDistance_m: number): Confidence {
  if (!(fromDistance_m > 0) || !(toDistance_m > 0)) return "rough";
  const ratio = Math.max(fromDistance_m, toDistance_m) / Math.min(fromDistance_m, toDistance_m);
  if (ratio <= 2) return "high";
  if (ratio <= 4) return "moderate";
  return "rough";
}

/**
 * Pick the PR that makes the best anchor for a target distance: the nearest
 * one in ratio, since prediction error grows with how far you extrapolate.
 *
 * Ties break toward the longer PR — a longer effort is a more complete measure
 * of fitness, and a single lucky 500m is easier to fluke than a 2k.
 */
export function bestAnchor(prs: RacePoint[], targetDistance_m: number): RacePoint | null {
  const usable = prs.filter((p) => p.distance_m > 0 && p.time_sec > 0);
  if (usable.length === 0 || !(targetDistance_m > 0)) return null;

  return usable.reduce((best, p) => {
    const d = Math.abs(Math.log(p.distance_m / targetDistance_m));
    const dBest = Math.abs(Math.log(best.distance_m / targetDistance_m));
    if (d < dBest) return p;
    if (d === dBest && p.distance_m > best.distance_m) return p;
    return best;
  });
}

/**
 * Fit the athlete's own Riegel exponent by least squares on log(distance)
 * against log(time). The slope *is* the exponent.
 *
 * Falls back to the generic exponent whenever the data can't support a fit:
 * too few points, all at one distance, a poor correlation, or a slope outside
 * what a human body produces.
 */
export function fitEnduranceProfile(prs: RacePoint[]): EnduranceProfile {
  const usable = prs.filter((p) => p.distance_m > 0 && p.time_sec > 0);

  // Repeats at the same distance carry no information about the slope; keep
  // the fastest at each so a slow duplicate can't drag the fit.
  const byDistance = new Map<number, RacePoint>();
  for (const p of usable) {
    const seen = byDistance.get(p.distance_m);
    if (!seen || p.time_sec < seen.time_sec) byDistance.set(p.distance_m, p);
  }
  const points = [...byDistance.values()];

  const fallback = (): EnduranceProfile => ({
    exponent: DEFAULT_EXPONENT,
    fitted: false,
    points: points.length,
    lean: "balanced",
  });

  if (points.length < MIN_POINTS_TO_FIT) return fallback();

  const xs = points.map((p) => Math.log(p.distance_m));
  const ys = points.map((p) => Math.log(p.time_sec));
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  if (sxx === 0 || syy === 0) return fallback();

  const slope = sxy / sxx;
  const r2 = (sxy * sxy) / (sxx * syy);

  if (!Number.isFinite(slope) || !Number.isFinite(r2)) return fallback();
  if (r2 < MIN_R2_TO_TRUST) return fallback();
  if (slope < PLAUSIBLE_EXPONENT.min || slope > PLAUSIBLE_EXPONENT.max) return fallback();

  return {
    exponent: slope,
    fitted: true,
    r2,
    points: n,
    lean: leanFor(slope),
  };
}

/**
 * Describe an exponent in words. The band around the default is wide enough
 * that normal scatter reads as "balanced" rather than flipping between labels
 * every time a new PR lands.
 */
export function leanFor(exponent: number): EnduranceProfile["lean"] {
  if (exponent < DEFAULT_EXPONENT - 0.04) return "endurance";
  if (exponent > DEFAULT_EXPONENT + 0.04) return "speed";
  return "balanced";
}

/**
 * Predict every target distance the athlete has no PR at, using their fitted
 * profile where possible.
 */
export function predictMissing(
  prs: RacePoint[],
  targetDistances: number[],
  profile: EnduranceProfile = fitEnduranceProfile(prs),
): Prediction[] {
  const have = new Set(prs.filter((p) => p.time_sec > 0).map((p) => p.distance_m));

  return targetDistances
    .filter((d) => !have.has(d))
    .map((d) => {
      const from = bestAnchor(prs, d);
      if (!from) return null;
      const time_sec = predictTime(from, d, profile.exponent);
      if (time_sec === null) return null;
      return {
        distance_m: d,
        time_sec,
        split_sec: Math.round((time_sec / d) * 500),
        from,
        confidence: confidenceFor(from.distance_m, d),
      } satisfies Prediction;
    })
    .filter((p): p is Prediction => p !== null)
    .sort((a, b) => a.distance_m - b.distance_m);
}

export interface ProfileGap {
  distance_m: number;
  actual_sec: number;
  expected_sec: number;
  /** Positive = slower than the profile predicts, i.e. a weak spot. */
  delta_sec: number;
  /** Same, as a share of the expected time — comparable across distances. */
  delta_pct: number;
}

/**
 * Compare each PR against what the athlete's other PRs predict for it.
 *
 * This is the part a single prediction can't tell you: which distance you are
 * relatively weak at. Each PR is held out and predicted from the rest, so a
 * standout result can't quietly define the baseline it's then measured against.
 *
 * Needs at least three PRs — with two, holding one out leaves a single point,
 * and one point can predict anything.
 */
export function findProfileGaps(prs: RacePoint[]): ProfileGap[] {
  const usable = prs.filter((p) => p.distance_m > 0 && p.time_sec > 0);
  if (usable.length < MIN_POINTS_TO_FIT) return [];

  const gaps: ProfileGap[] = [];

  for (const target of usable) {
    const others = usable.filter((p) => p.distance_m !== target.distance_m);
    if (others.length < 2) continue;

    const profile = fitEnduranceProfile(others);
    const anchor = bestAnchor(others, target.distance_m);
    if (!anchor) continue;

    const expected = predictTime(anchor, target.distance_m, profile.exponent);
    if (expected === null || expected <= 0) continue;

    const delta = target.time_sec - expected;
    gaps.push({
      distance_m: target.distance_m,
      actual_sec: target.time_sec,
      expected_sec: expected,
      delta_sec: Math.round(delta),
      delta_pct: (delta / expected) * 100,
    });
  }

  // Weakest first — that's the one worth acting on.
  return gaps.sort((a, b) => b.delta_pct - a.delta_pct);
}

/**
 * A gap smaller than this is inside the noise of a single race — conditions,
 * sleep, whether the erg was calibrated — and shouldn't be called a weakness.
 */
export const MEANINGFUL_GAP_PCT = 3;
