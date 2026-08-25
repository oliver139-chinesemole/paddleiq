/**
 * Unit tests for the stroke analysis pipeline.
 * All pure — no DOM, no MediaPipe, no camera.
 *
 * Poses are synthesized: a paddler is modelled as a fixed torso with a wrist
 * that oscillates sinusoidally at a known cadence, so the metrics have a known
 * right answer to check against.
 */
import { describe, it, expect } from "vitest";
import {
  mean,
  median,
  stdDev,
  coefficientOfVariation,
  smooth,
  torsoLength,
  shoulderSpread,
  segmentStrokes,
  analyzeStrokes,
  MIN_STROKES,
} from "../analyze";
import { LM, type Point, type PoseFrame } from "../landmarks";
import { buildFindings, overallScore } from "../feedback";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const pt = (x: number, y: number, visibility = 1): Point => ({ x, y, visibility });

interface SynthOptions {
  spm?: number;
  seconds?: number;
  fps?: number;
  /** Peak-to-peak wrist travel, in normalized image units. */
  amplitude?: number;
  /** Random timing wobble per stroke, as a fraction of the period. */
  jitter?: number;
  /** Marks every landmark as occluded, to exercise the no-pose path. */
  invisible?: boolean;
  /** Adds shoulder movement in phase with the stroke, to exercise rotation. */
  rotationAmplitude?: number;
  /** Height of the top wrist above the shoulder, in normalized units. */
  topArmOffset?: number;
}

/**
 * Builds a right-side paddler. Torso is 0.25 units tall (hip y 0.60, shoulder
 * y 0.35), so a 0.15-unit wrist swing is 0.6 torso units of reach.
 */
function synthFrames(o: SynthOptions = {}): PoseFrame[] {
  const {
    spm = 60,
    seconds = 20,
    fps = 30,
    amplitude = 0.15,
    jitter = 0,
    invisible = false,
    rotationAmplitude = 0.04,
    topArmOffset = 0.05,
  } = o;

  const periodMs = 60_000 / spm;
  const frames: PoseFrame[] = [];
  const total = Math.floor(seconds * fps);
  const vis = invisible ? 0.1 : 1;

  for (let i = 0; i < total; i++) {
    const tMs = (i / fps) * 1000;
    // Deterministic wobble — no Math.random, so runs are reproducible.
    const wobble = jitter ? Math.sin(i * 0.37) * jitter * periodMs : 0;
    const phase = (2 * Math.PI * (tMs + wobble)) / periodMs;

    const hipX = 0.5;
    // cos peaks at phase 0 => wrist furthest forward (smallest x) at the catch.
    const wristX = hipX - amplitude * Math.cos(phase);
    // Wound up at the catch, square again by the exit: gap goes 1 -> 0 -> 1.
    const shoulderGap = (rotationAmplitude * (1 + Math.cos(phase))) / 2;

    const lms: Point[] = Array.from({ length: 33 }, () => pt(0.5, 0.5, vis));
    lms[LM.LEFT_SHOULDER] = pt(0.5 - shoulderGap / 2, 0.35, vis);
    lms[LM.RIGHT_SHOULDER] = pt(0.5 + shoulderGap / 2, 0.35, vis);
    lms[LM.LEFT_HIP] = pt(hipX, 0.6, vis);
    lms[LM.RIGHT_HIP] = pt(hipX, 0.6, vis);
    // Right side paddles => right wrist drives, left wrist rides on top.
    lms[LM.RIGHT_WRIST] = pt(wristX, 0.5, vis);
    lms[LM.LEFT_WRIST] = pt(0.5, 0.35 - topArmOffset, vis);

    frames.push({ tMs, landmarks: lms });
  }
  return frames;
}

// ── Numeric helpers ──────────────────────────────────────────────────────────

describe("numeric helpers", () => {
  it("computes mean, median and stdDev", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(stdDev([2, 2, 2])).toBe(0);
    expect(stdDev([1, 3])).toBeCloseTo(1, 6);
  });

  it("returns neutral values for empty input rather than NaN", () => {
    expect(mean([])).toBe(0);
    expect(median([])).toBe(0);
    expect(stdDev([])).toBe(0);
    expect(stdDev([5])).toBe(0);
    expect(coefficientOfVariation([])).toBe(0);
  });

  it("reports coefficient of variation as a percentage", () => {
    expect(coefficientOfVariation([10, 10, 10])).toBe(0);
    expect(coefficientOfVariation([8, 12])).toBeCloseTo(20, 6);
  });

  it("guards against divide-by-zero when the mean is zero", () => {
    expect(coefficientOfVariation([-5, 5])).toBe(0);
  });

  it("smooths without shifting the signal out of phase", () => {
    const spike = [0, 0, 0, 10, 0, 0, 0];
    const out = smooth(spike, 3);
    // The spike flattens across its neighbours but stays centred on index 3:
    // index 3 is still a maximum, and the shoulders either side are equal.
    expect(out[3]).toBe(Math.max(...out));
    expect(out[2]).toBeCloseTo(out[4], 9);
    expect(out[3]).toBeLessThan(10);
  });

  it("passes the signal through untouched for a window of 1", () => {
    expect(smooth([1, 2, 3], 1)).toEqual([1, 2, 3]);
    expect(smooth([], 5)).toEqual([]);
  });
});

// ── Per-frame geometry ───────────────────────────────────────────────────────

describe("torsoLength", () => {
  it("measures shoulder-to-hip distance", () => {
    const lms = synthFrames()[0].landmarks;
    expect(torsoLength(lms)).toBeCloseTo(0.25, 2);
  });

  it("returns null when the torso is not visible", () => {
    const lms = synthFrames({ invisible: true })[0].landmarks;
    expect(torsoLength(lms)).toBeNull();
  });

  it("returns null rather than zero for a degenerate torso", () => {
    const lms: Point[] = Array.from({ length: 33 }, () => pt(0.5, 0.5));
    expect(torsoLength(lms)).toBeNull();
  });
});

describe("shoulderSpread", () => {
  it("scales the shoulder gap by torso length", () => {
    const lms: Point[] = Array.from({ length: 33 }, () => pt(0.5, 0.5));
    lms[LM.LEFT_SHOULDER] = pt(0.4, 0.35);
    lms[LM.RIGHT_SHOULDER] = pt(0.5, 0.35);
    expect(shoulderSpread(lms, 0.25)).toBeCloseTo(0.4, 6);
  });

  it("returns null for an invalid torso length", () => {
    const lms: Point[] = Array.from({ length: 33 }, () => pt(0.5, 0.5));
    expect(shoulderSpread(lms, 0)).toBeNull();
  });
});

// ── Segmentation ─────────────────────────────────────────────────────────────

describe("segmentStrokes", () => {
  it("finds one stroke per cycle of a clean oscillation", () => {
    const fps = 30;
    const seconds = 10;
    const spm = 60; // one stroke per second => ~10 strokes
    const times: number[] = [];
    const drive: number[] = [];
    for (let i = 0; i < fps * seconds; i++) {
      const tMs = (i / fps) * 1000;
      times.push(tMs);
      drive.push(0.5 * Math.cos((2 * Math.PI * tMs) / (60_000 / spm)));
    }
    const strokes = segmentStrokes(drive, times);
    expect(strokes.length).toBeGreaterThanOrEqual(8);
    expect(strokes.length).toBeLessThanOrEqual(10);
    for (const s of strokes) expect(s.exitIdx).toBeGreaterThan(s.catchIdx);
  });

  it("rejects flat signals with no real stroke amplitude", () => {
    const times = Array.from({ length: 100 }, (_, i) => i * 33);
    const drive = times.map((_, i) => 0.001 * Math.sin(i));
    expect(segmentStrokes(drive, times)).toEqual([]);
  });

  it("returns nothing for mismatched or tiny inputs", () => {
    expect(segmentStrokes([1, 2, 3], [1, 2])).toEqual([]);
    expect(segmentStrokes([], [])).toEqual([]);
  });

  it("discards cycles faster than any real paddler", () => {
    // 300 SPM — well above the plausible ceiling.
    const times: number[] = [];
    const drive: number[] = [];
    for (let i = 0; i < 300; i++) {
      const tMs = (i / 120) * 1000;
      times.push(tMs);
      drive.push(0.5 * Math.cos((2 * Math.PI * tMs) / 200));
    }
    expect(segmentStrokes(drive, times)).toEqual([]);
  });
});

// ── End-to-end analysis ──────────────────────────────────────────────────────

describe("analyzeStrokes", () => {
  it("recovers the stroke rate it was given", () => {
    for (const spm of [40, 60, 80]) {
      const res = analyzeStrokes(synthFrames({ spm, seconds: 20 }), "right");
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.metrics.strokeRateSpm).toBeGreaterThan(spm - 4);
      expect(res.metrics.strokeRateSpm).toBeLessThan(spm + 4);
    }
  });

  it("counts a plausible number of strokes", () => {
    const res = analyzeStrokes(synthFrames({ spm: 60, seconds: 20 }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 20s at 60spm is ~20 strokes; edge cycles may be trimmed.
    expect(res.metrics.strokeCount).toBeGreaterThanOrEqual(16);
    expect(res.metrics.strokeCount).toBeLessThanOrEqual(20);
  });

  it("measures reach in torso units", () => {
    // amplitude 0.15 over a 0.25 torso => 0.6 torso units of forward reach.
    const res = analyzeStrokes(synthFrames({ amplitude: 0.15 }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.reach).toBeGreaterThan(0.45);
    expect(res.metrics.reach).toBeLessThan(0.65);
  });

  it("scores an even cadence as more consistent than a wobbly one", () => {
    const steady = analyzeStrokes(synthFrames({ jitter: 0 }), "right");
    const wobbly = analyzeStrokes(synthFrames({ jitter: 0.18 }), "right");
    expect(steady.ok && wobbly.ok).toBe(true);
    if (!steady.ok || !wobbly.ok) return;
    expect(steady.metrics.timingVariationPct).toBeLessThan(
      wobbly.metrics.timingVariationPct
    );
  });

  it("detects more rotation when the shoulders open further", () => {
    const lots = analyzeStrokes(synthFrames({ rotationAmplitude: 0.08 }), "right");
    const little = analyzeStrokes(synthFrames({ rotationAmplitude: 0.01 }), "right");
    expect(lots.ok && little.ok).toBe(true);
    if (!lots.ok || !little.ok) return;
    expect(lots.metrics.rotationRange).not.toBeNull();
    expect(lots.metrics.rotationRange!).toBeGreaterThan(little.metrics.rotationRange!);
  });

  it("reads a raised top hand as positive height", () => {
    const res = analyzeStrokes(synthFrames({ topArmOffset: 0.05 }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.topArmHeight!).toBeGreaterThan(0);
  });

  it("reads a dropped top hand as negative height", () => {
    const res = analyzeStrokes(synthFrames({ topArmOffset: -0.05 }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.topArmHeight!).toBeLessThan(0);
  });

  it("works for a left-side paddler by mirroring the driving wrist", () => {
    const frames = synthFrames();
    // Swap the wrists so the left hand drives.
    for (const f of frames) {
      const l = f.landmarks[LM.LEFT_WRIST];
      f.landmarks[LM.LEFT_WRIST] = f.landmarks[LM.RIGHT_WRIST];
      f.landmarks[LM.RIGHT_WRIST] = l;
    }
    const res = analyzeStrokes(frames, "left");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.strokeRateSpm).toBeGreaterThan(55);
    expect(res.metrics.strokeRateSpm).toBeLessThan(65);
  });

  it("handles a paddler facing the other way", () => {
    const frames = synthFrames();
    // Mirror the image horizontally; the catch is now the maximum x, not minimum.
    for (const f of frames) {
      for (const p of f.landmarks) p.x = 1 - p.x;
    }
    const res = analyzeStrokes(frames, "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.strokeRateSpm).toBeGreaterThan(55);
    expect(res.metrics.strokeRateSpm).toBeLessThan(65);
  });

  it("reports poseQuality of 1 when every frame is usable", () => {
    const res = analyzeStrokes(synthFrames(), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.poseQuality).toBeCloseTo(1, 2);
  });

  // ── Failure paths ──────────────────────────────────────────────────────────

  it("rejects an empty clip", () => {
    const res = analyzeStrokes([], "right");
    expect(res).toEqual({ ok: false, reason: "no-frames" });
  });

  it("rejects a clip where the paddler is not visible", () => {
    const res = analyzeStrokes(synthFrames({ invisible: true }), "right");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no-pose");
  });

  it("rejects a clip that is too short to hold a rhythm", () => {
    const res = analyzeStrokes(synthFrames({ seconds: 2 }), "right");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("too-short");
  });

  it("rejects a paddler sitting still", () => {
    const frames = synthFrames({ seconds: 20, amplitude: 0 });
    const res = analyzeStrokes(frames, "right");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no-strokes");
  });

  it("needs at least MIN_STROKES before reporting", () => {
    // 6s at 30spm is only ~3 strokes.
    const res = analyzeStrokes(synthFrames({ spm: 30, seconds: 6 }), "right");
    if (!res.ok) {
      expect(res.reason).toBe("no-strokes");
    } else {
      expect(res.metrics.strokeCount).toBeGreaterThanOrEqual(MIN_STROKES);
    }
  });
});

// ── Feedback layer ───────────────────────────────────────────────────────────

describe("buildFindings", () => {
  const metricsFor = (o: SynthOptions) => {
    const res = analyzeStrokes(synthFrames(o), "right");
    if (!res.ok) throw new Error(`fixture did not analyze: ${res.reason}`);
    return res.metrics;
  };

  it("produces a finding per measurable dimension", () => {
    const findings = buildFindings(metricsFor({}));
    expect(findings.length).toBeGreaterThanOrEqual(5);
    const ids = findings.map((f) => f.id);
    expect(ids).toContain("timing");
    expect(ids).toContain("rotation");
    expect(ids).toContain("reach");
  });

  it("leads with the problems, not the praise", () => {
    const findings = buildFindings(metricsFor({ jitter: 0.2, rotationAmplitude: 0.005 }));
    const ranks = findings.map((f) =>
      f.severity === "work-on" ? 0 : f.severity === "watch" ? 1 : 2
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("links every finding to a real technique lesson", () => {
    const findings = buildFindings(metricsFor({}));
    for (const f of findings) {
      expect(f.lessonId).toMatch(/^t[1-8]$/);
      expect(f.drill.length).toBeGreaterThan(10);
    }
  });

  it("drops rotation when the shoulders were never visible", () => {
    const m = { ...metricsFor({}), rotationRange: null, topArmHeight: null };
    const ids = buildFindings(m).map((f) => f.id);
    expect(ids).not.toContain("rotation");
    expect(ids).not.toContain("top-arm");
  });

  it("scores clean technique above sloppy technique", () => {
    const clean = overallScore(buildFindings(metricsFor({ jitter: 0, rotationAmplitude: 0.08 })));
    const sloppy = overallScore(
      buildFindings(metricsFor({ jitter: 0.2, rotationAmplitude: 0.005, amplitude: 0.08 }))
    );
    expect(clean).toBeGreaterThan(sloppy);
    expect(clean).toBeLessThanOrEqual(100);
    expect(sloppy).toBeGreaterThanOrEqual(0);
  });

  it("returns zero rather than NaN for an empty finding list", () => {
    expect(overallScore([])).toBe(0);
  });
});
