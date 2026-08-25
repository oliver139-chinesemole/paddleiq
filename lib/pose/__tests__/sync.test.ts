/**
 * Unit tests for team sync analysis.
 *
 * Builds synthetic crews: N paddlers at fixed x positions, each catching at a
 * known offset from the crew. Since the offsets are inputs, the measured
 * offsets have a right answer to check against.
 */
import { describe, it, expect } from "vitest";
import {
  hipX,
  toSeatTracks,
  analyzeTeamSync,
  syncVerdict,
  worstOffenders,
  MIN_SEATS,
  type MultiPoseFrame,
} from "../sync";
import { LM, type Point } from "../landmarks";

const pt = (x: number, y: number, visibility = 1): Point => ({ x, y, visibility });

/**
 * One paddler's landmarks at a given phase. Torso is 0.25 tall, matching the
 * single-paddler fixtures, and the driving wrist swings 0.15 either side.
 */
function paddlerAt(baseX: number, phase: number, visible = true): Point[] {
  const v = visible ? 1 : 0.1;
  const lms: Point[] = Array.from({ length: 33 }, () => pt(baseX, 0.5, v));
  lms[LM.LEFT_SHOULDER] = pt(baseX - 0.02, 0.35, v);
  lms[LM.RIGHT_SHOULDER] = pt(baseX + 0.02, 0.35, v);
  lms[LM.LEFT_HIP] = pt(baseX, 0.6, v);
  lms[LM.RIGHT_HIP] = pt(baseX, 0.6, v);
  lms[LM.RIGHT_WRIST] = pt(baseX - 0.15 * Math.cos(phase), 0.5, v);
  lms[LM.LEFT_WRIST] = pt(baseX, 0.3, v);
  return lms;
}

interface CrewOptions {
  /** Per-seat timing offset in ms. Positive = that seat catches late. */
  offsetsMs?: number[];
  spm?: number;
  seconds?: number;
  fps?: number;
  /** Seats to blank out entirely, to exercise dropout handling. */
  dropSeat?: number;
  /** Blank every seat on frames where index % n === 0. */
  dropEveryNthFrame?: number;
}

function synthCrew(o: CrewOptions = {}): MultiPoseFrame[] {
  const {
    offsetsMs = [0, 0, 0],
    spm = 60,
    seconds = 20,
    fps = 30,
    dropSeat,
    dropEveryNthFrame,
  } = o;

  const periodMs = 60_000 / spm;
  const frames: MultiPoseFrame[] = [];
  const total = Math.floor(seconds * fps);

  for (let i = 0; i < total; i++) {
    const tMs = (i / fps) * 1000;
    const poses: Point[][] = [];
    offsetsMs.forEach((off, seat) => {
      if (seat === dropSeat) return;
      const visible = !(dropEveryNthFrame && i % dropEveryNthFrame === 0);
      if (!visible) return;
      // Seats spread evenly across the frame, well apart.
      const baseX = 0.2 + seat * 0.25;
      // A late paddler is behind in phase, so subtract their offset from t.
      const phase = (2 * Math.PI * (tMs - off)) / periodMs;
      poses.push(paddlerAt(baseX, phase));
    });
    frames.push({ tMs, poses });
  }
  return frames;
}

// ── hipX ─────────────────────────────────────────────────────────────────────

describe("hipX", () => {
  it("averages the two hips", () => {
    const lms = paddlerAt(0.4, 0);
    expect(hipX(lms)).toBeCloseTo(0.4, 6);
  });

  it("returns null when the hips aren't visible", () => {
    expect(hipX(paddlerAt(0.4, 0, false))).toBeNull();
  });
});

// ── Seat tracking ────────────────────────────────────────────────────────────

describe("toSeatTracks", () => {
  it("splits a crew into one track per seat", () => {
    const tracks = toSeatTracks(synthCrew({ offsetsMs: [0, 0, 0] }));
    expect(tracks).toHaveLength(3);
    for (const t of tracks) expect(t.length).toBeGreaterThan(500);
  });

  it("keeps seats in left-to-right order", () => {
    const tracks = toSeatTracks(synthCrew({ offsetsMs: [0, 0, 0] }));
    const xs = tracks.map((t) => hipX(t[0].landmarks)!);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("holds identity when a seat drops out on some frames", () => {
    // Every 5th frame loses everyone; naive per-frame sorting would still cope,
    // so also confirm the seat count doesn't inflate.
    const tracks = toSeatTracks(synthCrew({ offsetsMs: [0, 0, 0], dropEveryNthFrame: 5 }));
    expect(tracks).toHaveLength(3);
    const xs = tracks.map((t) => hipX(t[0].landmarks)!);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it("uses the modal detection count, not the maximum", () => {
    const frames = synthCrew({ offsetsMs: [0, 0] });
    // One spurious extra detection on a single frame must not create a 3rd seat.
    frames[10].poses.push(paddlerAt(0.95, 0));
    expect(toSeatTracks(frames)).toHaveLength(2);
  });

  it("returns nothing for empty input", () => {
    expect(toSeatTracks([])).toEqual([]);
  });
});

// ── Sync measurement ─────────────────────────────────────────────────────────

describe("analyzeTeamSync", () => {
  it("reports a near-zero spread for a perfectly synced crew", () => {
    const res = analyzeTeamSync(synthCrew({ offsetsMs: [0, 0, 0] }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.spreadMs).toBeLessThan(40);
    expect(res.result.seats).toHaveLength(3);
  });

  it("recovers the offset of a late paddler", () => {
    // Seat 2 catches 150ms after the others.
    const res = analyzeTeamSync(synthCrew({ offsetsMs: [0, 0, 150] }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const late = res.result.seats.find((s) => s.seat === 2)!;
    const onTime = res.result.seats.find((s) => s.seat === 0)!;
    expect(late.offsetMs).toBeGreaterThan(onTime.offsetMs);
    // Sampled at 30fps, so expect the offset within roughly a frame or two.
    expect(late.offsetMs - onTime.offsetMs).toBeGreaterThan(80);
  });

  it("separates an early paddler from a late one by sign", () => {
    const res = analyzeTeamSync(synthCrew({ offsetsMs: [-120, 0, 120] }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [a, , c] = res.result.seats;
    expect(a.offsetMs).toBeLessThan(0);
    expect(c.offsetMs).toBeGreaterThan(0);
    expect(res.result.spreadMs).toBeGreaterThan(120);
  });

  it("scores a tight crew as a smaller spread than a ragged one", () => {
    const tight = analyzeTeamSync(synthCrew({ offsetsMs: [0, 20, -20] }), "right");
    const ragged = analyzeTeamSync(synthCrew({ offsetsMs: [0, 200, -200] }), "right");
    expect(tight.ok && ragged.ok).toBe(true);
    if (!tight.ok || !ragged.ok) return;
    expect(tight.result.spreadMs).toBeLessThan(ragged.result.spreadMs);
  });

  it("reports the crew cadence", () => {
    const res = analyzeTeamSync(synthCrew({ spm: 72, offsetsMs: [0, 0] }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.strokeRateSpm).toBeGreaterThan(68);
    expect(res.result.strokeRateSpm).toBeLessThan(76);
  });

  it("pairs a sensible number of boat strokes", () => {
    const res = analyzeTeamSync(synthCrew({ spm: 60, seconds: 20, offsetsMs: [0, 0] }), "right");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.pairedStrokes).toBeGreaterThanOrEqual(10);
  });

  // ── Failure paths ──────────────────────────────────────────────────────────

  it("rejects empty input", () => {
    expect(analyzeTeamSync([], "right")).toEqual({ ok: false, reason: "no-frames" });
  });

  it("rejects a single paddler", () => {
    const res = analyzeTeamSync(synthCrew({ offsetsMs: [0] }), "right");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("too-few-paddlers");
  });

  it("rejects a crew sitting still", () => {
    const frames = synthCrew({ offsetsMs: [0, 0] }).map((f) => ({
      tMs: f.tMs,
      poses: f.poses.map((_, seat) => paddlerAt(0.2 + seat * 0.25, 0)),
    }));
    const res = analyzeTeamSync(frames, "right");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no-strokes");
  });

  it("rejects a clip too short to hold a rhythm", () => {
    const res = analyzeTeamSync(synthCrew({ seconds: 2, offsetsMs: [0, 0] }), "right");
    expect(res.ok).toBe(false);
  });

  it("needs at least MIN_SEATS to say anything", () => {
    expect(MIN_SEATS).toBeGreaterThanOrEqual(2);
  });
});

// ── Verdicts ─────────────────────────────────────────────────────────────────

describe("syncVerdict", () => {
  it("bands spread into verdicts", () => {
    expect(syncVerdict(10)).toBe("locked-in");
    expect(syncVerdict(60)).toBe("close");
    expect(syncVerdict(120)).toBe("loose");
    expect(syncVerdict(400)).toBe("scattered");
  });

  it("always returns a verdict, however bad the spread", () => {
    expect(syncVerdict(Number.MAX_SAFE_INTEGER)).toBe("scattered");
    expect(syncVerdict(0)).toBe("locked-in");
  });
});

describe("worstOffenders", () => {
  it("ranks by distance from the crew, regardless of direction", () => {
    const result = {
      seats: [
        { seat: 0, strokeCount: 10, offsetMs: 10, offsetSpreadMs: 5, strokeRateSpm: 60 },
        { seat: 1, strokeCount: 10, offsetMs: -200, offsetSpreadMs: 5, strokeRateSpm: 60 },
        { seat: 2, strokeCount: 10, offsetMs: 90, offsetSpreadMs: 5, strokeRateSpm: 60 },
      ],
      spreadMs: 290,
      strokeRateSpm: 60,
      pairedStrokes: 10,
    };
    expect(worstOffenders(result, 2).map((s) => s.seat)).toEqual([1, 2]);
  });
});
