// Turns raw stroke measurements into coaching findings, each linked back to a
// lesson in the technique library.
//
// A note on the thresholds below: they are heuristic starting points chosen to
// match how the existing lessons describe good form, not values validated
// against a labelled dataset of paddlers. They are deliberately gathered in one
// block so they can be tuned once real clips have been reviewed. Findings are
// therefore phrased as observations ("your reach varies a lot") rather than
// verdicts ("your catch is wrong").

import type { StrokeMetrics } from "./analyze";

export type Severity = "good" | "watch" | "work-on";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  /** Human-readable measurement, e.g. "8.4%" or "0.62 torso". */
  value: string;
  message: string;
  /** Technique lesson id from lib/data/seed.ts (t1–t8). */
  lessonId: string;
  lessonTitle: string;
  /** One concrete thing to try next session. */
  drill: string;
}

// ─── thresholds (provisional — tune against reviewed clips) ──────────────────

const T = {
  /** Catch-to-catch timing spread, as a percentage. */
  timingTight: 6,
  timingLoose: 12,
  /** Reach repeatability across strokes, as a percentage. */
  reachConsistent: 10,
  reachErratic: 18,
  /** Forward reach at the catch, in torso units. */
  reachLong: 0.6,
  reachShort: 0.42,
  /** Catch-to-exit wrist travel, in torso units. */
  lengthLong: 0.85,
  lengthShort: 0.6,
  /** Catch-to-exit change in shoulder spread — the rotation proxy. */
  rotationStrong: 0.15,
  rotationWeak: 0.08,
  /** Top wrist height above the shoulder at the catch, in torso units. */
  topArmHigh: 0.12,
  topArmLow: 0.0,
} as const;

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function torso(n: number): string {
  return `${n.toFixed(2)} torso`;
}

// ─── findings ────────────────────────────────────────────────────────────────

function timingFinding(m: StrokeMetrics): Finding {
  const v = m.timingVariationPct;
  const severity: Severity = v <= T.timingTight ? "good" : v <= T.timingLoose ? "watch" : "work-on";
  return {
    id: "timing",
    title: "Stroke timing",
    severity,
    value: pct(v),
    message:
      severity === "good"
        ? "Your catch-to-catch timing is very even. That rhythm is what lets a boat sit together at race pace."
        : severity === "watch"
          ? "Your rhythm drifts a little between strokes. Tightening it up makes you far easier to follow."
          : "Your stroke timing varies a lot. In a boat this is the difference between driving the hull and fighting it.",
    lessonId: "t4",
    lessonTitle: "Stroke Timing & Synchronization",
    drill: "Paddle 3 × 20 strokes to a metronome at your current rate, then check this number again.",
  };
}

function rotationFinding(m: StrokeMetrics): Finding | null {
  if (m.rotationRange === null) return null;
  const v = m.rotationRange;
  const severity: Severity = v >= T.rotationStrong ? "good" : v >= T.rotationWeak ? "watch" : "work-on";
  return {
    id: "rotation",
    title: "Torso rotation",
    severity,
    value: torso(v),
    message:
      severity === "good"
        ? "Your shoulders open and close through a good range — you're driving with your trunk, not just your arms."
        : severity === "watch"
          ? "There's some rotation, but your shoulders stay fairly square. More trunk means more power for the same effort."
          : "Your shoulders barely rotate through the stroke, which usually means the arms are doing the work. That fatigues roughly three times faster.",
    lessonId: "t2",
    lessonTitle: "Torso Rotation",
    drill: "Land drill: sit on the floor and mimic the stroke, feeling the obliques fire before the arms move.",
  };
}

function reachFinding(m: StrokeMetrics): Finding {
  const v = m.reach;
  const severity: Severity = v >= T.reachLong ? "good" : v >= T.reachShort ? "watch" : "work-on";
  return {
    id: "reach",
    title: "Reach at the catch",
    severity,
    value: torso(v),
    message:
      severity === "good"
        ? "You're getting the blade well forward of the hip before the catch — that's where free distance comes from."
        : severity === "watch"
          ? "Your catch is landing a bit close to the hip. A little more reach adds length to every stroke."
          : "You're catching close to your hips, which shortens the stroke considerably. Reach usually comes from rotation, not from stretching the arms.",
    lessonId: "t1",
    lessonTitle: "The Catch",
    drill: "Pause drill: freeze at full reach for one second before each catch, for 10 strokes.",
  };
}

function lengthFinding(m: StrokeMetrics): Finding {
  const v = m.strokeLength;
  const severity: Severity = v >= T.lengthLong ? "good" : v >= T.lengthShort ? "watch" : "work-on";
  return {
    id: "length",
    title: "Stroke length",
    severity,
    value: torso(v),
    message:
      severity === "good"
        ? "Good travel from catch to exit — you're using the whole stroke."
        : severity === "watch"
          ? "Your stroke is slightly short. Check whether you're exiting early or catching late."
          : "Your blade covers a short distance in the water. Short strokes at a high rate burn energy without moving the boat.",
    lessonId: "t3",
    lessonTitle: "The Exit",
    drill: "Count 10 strokes focusing only on a clean exit at the hip — not before, not after.",
  };
}

function topArmFinding(m: StrokeMetrics): Finding | null {
  if (m.topArmHeight === null) return null;
  const v = m.topArmHeight;
  const severity: Severity = v >= T.topArmHigh ? "good" : v >= T.topArmLow ? "watch" : "work-on";
  return {
    id: "top-arm",
    title: "Top arm position",
    severity,
    value: torso(v),
    message:
      severity === "good"
        ? "Your top hand stays stacked above the shoulder at the catch. That's what keeps the blade vertical."
        : severity === "watch"
          ? "Your top hand sits a little low at the catch. Driving it higher keeps the blade gripping rather than slicing."
          : "Your top hand drops below the shoulder at the catch, which flattens the blade angle and spills power.",
    lessonId: "t1",
    lessonTitle: "The Catch",
    drill: "Stack your hands — top arm fully extended overhead — and hold that shape for 10 slow strokes.",
  };
}

function consistencyFinding(m: StrokeMetrics): Finding {
  const v = m.reachVariationPct;
  const severity: Severity = v <= T.reachConsistent ? "good" : v <= T.reachErratic ? "watch" : "work-on";
  return {
    id: "consistency",
    title: "Stroke repeatability",
    severity,
    value: pct(v),
    message:
      severity === "good"
        ? "Every stroke lands in nearly the same place. Repeatability like this is the mark of a trained paddler."
        : severity === "watch"
          ? "Your reach moves around between strokes. Some variation is normal when you fatigue."
          : "Your catch position changes noticeably stroke to stroke, which makes it hard for anyone behind you to follow.",
    lessonId: "t2",
    lessonTitle: "Torso Rotation",
    drill: "Slow erg at low resistance: 2 minutes focused only on hitting the same catch position every time.",
  };
}

const SEVERITY_RANK: Record<Severity, number> = { "work-on": 0, watch: 1, good: 2 };

/** Builds the finding list, worst first so the UI leads with what to fix. */
export function buildFindings(m: StrokeMetrics): Finding[] {
  const all = [
    timingFinding(m),
    rotationFinding(m),
    reachFinding(m),
    lengthFinding(m),
    topArmFinding(m),
    consistencyFinding(m),
  ].filter((f): f is Finding => f !== null);

  return all.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** 0–100 summary score. Weighted toward the things we measure most reliably. */
export function overallScore(findings: Finding[]): number {
  if (!findings.length) return 0;
  const points = findings.reduce(
    (sum, f) => sum + (f.severity === "good" ? 100 : f.severity === "watch" ? 65 : 30),
    0
  );
  return Math.round(points / findings.length);
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  good: "Looking good",
  watch: "Worth watching",
  "work-on": "Work on this",
};
