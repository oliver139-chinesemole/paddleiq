// Team sync analysis — how closely a crew catches together.
//
// Sync is the whole game in dragon boat, and it is the one thing a coach on the
// dock genuinely cannot measure: 40ms of timing spread is invisible to the eye
// but very visible in hull speed. This turns a side-on video of the boat into a
// per-seat timing offset.
//
// Pure functions only. Frame capture lives in detector.ts.

import { LM, isVisible, type Point, type PoseFrame, type PaddleSide } from "./landmarks";
import { analyzeStrokes, median, stdDev, type Stroke } from "./analyze";

/** One frame of a multi-person capture: every paddler MediaPipe found. */
export interface MultiPoseFrame {
  tMs: number;
  poses: Point[][];
}

/** Minimum paddlers needed before "sync" means anything. */
export const MIN_SEATS = 2;
/** Minimum boat strokes where enough seats were paired to draw conclusions. */
export const MIN_PAIRED_STROKES = 4;

// ─── seat identity ───────────────────────────────────────────────────────────

/**
 * Horizontal anchor for a detected pose. Hips are used rather than the centroid
 * because arms and paddles swing while the seat itself does not move.
 */
export function hipX(lms: Point[]): number | null {
  const l = lms[LM.LEFT_HIP];
  const r = lms[LM.RIGHT_HIP];
  const pts = [l, r].filter(isVisible);
  if (!pts.length) return null;
  return pts.reduce((s, p) => s + p.x, 0) / pts.length;
}

/**
 * Splits a multi-person capture into one track per seat.
 *
 * Paddlers in a boat never swap places, so horizontal position is a stable
 * identity — far simpler than general multi-object tracking. Sorting each frame
 * independently would still scramble identities whenever a detection drops out,
 * so we first establish fixed anchors from the frames where everyone was found,
 * then assign each detection to its nearest anchor.
 */
export function toSeatTracks(frames: MultiPoseFrame[]): PoseFrame[][] {
  if (!frames.length) return [];

  // Positions per frame, ordered left to right.
  const perFrame = frames.map((f) =>
    f.poses
      .map((p) => ({ x: hipX(p), lms: p }))
      .filter((d): d is { x: number; lms: Point[] } => d.x !== null)
      .sort((a, b) => a.x - b.x)
  );

  // The modal detection count is the crew size — more robust than the max,
  // which a single spurious detection would inflate.
  const counts = new Map<number, number>();
  for (const d of perFrame) counts.set(d.length, (counts.get(d.length) ?? 0) + 1);
  let seatCount = 0;
  let best = 0;
  for (const [n, c] of counts) {
    if (n > 0 && c > best) { best = c; seatCount = n; }
  }
  if (seatCount === 0) return [];

  // Anchor each seat at the median x it occupied across complete frames.
  const columns: number[][] = Array.from({ length: seatCount }, () => []);
  for (const d of perFrame) {
    if (d.length !== seatCount) continue;
    d.forEach((det, i) => columns[i].push(det.x));
  }
  const anchors = columns.map((xs) => median(xs));

  const tracks: PoseFrame[][] = Array.from({ length: seatCount }, () => []);

  frames.forEach((frame, fi) => {
    const dets = [...perFrame[fi]];
    const taken = new Set<number>();

    // Greedy nearest-anchor assignment, closest pairs first, one seat each.
    const pairs: Array<{ seat: number; det: number; dist: number }> = [];
    anchors.forEach((a, seat) => {
      dets.forEach((det, di) => pairs.push({ seat, det: di, dist: Math.abs(det.x - a) }));
    });
    pairs.sort((p, q) => p.dist - q.dist);

    const usedDet = new Set<number>();
    for (const p of pairs) {
      if (taken.has(p.seat) || usedDet.has(p.det)) continue;
      taken.add(p.seat);
      usedDet.add(p.det);
      tracks[p.seat].push({ tMs: frame.tMs, landmarks: dets[p.det].lms });
    }
  });

  return tracks;
}

// ─── sync measurement ────────────────────────────────────────────────────────

export interface SeatSync {
  /** 0 is leftmost as the camera sees it. */
  seat: number;
  strokeCount: number;
  /** Median timing error vs the crew. Positive is late, negative is early. */
  offsetMs: number;
  /** How repeatable that error is. Low means consistently off, not erratic. */
  offsetSpreadMs: number;
  strokeRateSpm: number;
}

export interface TeamSyncResult {
  seats: SeatSync[];
  /** Gap between the earliest and latest seat. The headline number. */
  spreadMs: number;
  /** Crew cadence, from the paired strokes. */
  strokeRateSpm: number;
  pairedStrokes: number;
}

export type SyncFailure = "no-frames" | "too-few-paddlers" | "no-strokes";

export const SYNC_FAILURE_MESSAGES: Record<SyncFailure, string> = {
  "no-frames": "No frames were captured. Try recording again.",
  "too-few-paddlers": `Found fewer than ${MIN_SEATS} paddlers. Film the boat side-on so several seats are visible at once.`,
  "no-strokes": "Couldn't read enough matching strokes. Film side-on, keep the camera still, and capture at least 15 seconds of steady paddling.",
};

export type TeamSyncAnalysis =
  | { ok: true; result: TeamSyncResult }
  | { ok: false; reason: SyncFailure };

/**
 * Groups catches from every seat into boat strokes, then measures how far each
 * seat sits from the crew's average catch on each one.
 */
export function analyzeTeamSync(
  frames: MultiPoseFrame[],
  side: PaddleSide
): TeamSyncAnalysis {
  if (!frames.length) return { ok: false, reason: "no-frames" };

  const tracks = toSeatTracks(frames);
  if (tracks.length < MIN_SEATS) return { ok: false, reason: "too-few-paddlers" };

  // Reuse the single-paddler pipeline per seat.
  const perSeat = tracks.map((t) => analyzeStrokes(t, side));
  const usable = perSeat
    .map((r, seat) => ({ seat, r }))
    .filter((x): x is { seat: number; r: Extract<typeof x.r, { ok: true }> } => x.r.ok);

  if (usable.length < MIN_SEATS) return { ok: false, reason: "no-strokes" };

  // A boat stroke is a cluster of catches close together in time. Half the
  // slowest seat's period is a safe window: wide enough to catch a late
  // paddler, narrow enough that it can't swallow the next stroke.
  const rates = usable.map((u) => u.r.metrics.strokeRateSpm).filter((r) => r > 0);
  if (!rates.length) return { ok: false, reason: "no-strokes" };
  const periodMs = 60_000 / median(rates);
  const windowMs = periodMs / 2;

  type Catch = { seat: number; tMs: number };
  const catches: Catch[] = usable
    .flatMap((u) => u.r.strokes.map((s: Stroke) => ({ seat: u.seat, tMs: s.catchTMs })))
    .sort((a, b) => a.tMs - b.tMs);

  // Sweep the sorted catches, cutting a new group whenever the gap from the
  // group's first catch exceeds the window.
  const groups: Catch[][] = [];
  let current: Catch[] = [];
  for (const c of catches) {
    if (!current.length || c.tMs - current[0].tMs <= windowMs) {
      current.push(c);
    } else {
      groups.push(current);
      current = [c];
    }
  }
  if (current.length) groups.push(current);

  // Only groups where a seat appears at most once, and enough seats are
  // present, describe a real shared stroke.
  const paired = groups.filter((g) => {
    const seats = new Set(g.map((c) => c.seat));
    return seats.size === g.length && seats.size >= MIN_SEATS;
  });

  if (paired.length < MIN_PAIRED_STROKES) return { ok: false, reason: "no-strokes" };

  const offsets = new Map<number, number[]>();
  for (const g of paired) {
    const mean = g.reduce((s, c) => s + c.tMs, 0) / g.length;
    for (const c of g) {
      const list = offsets.get(c.seat) ?? [];
      list.push(c.tMs - mean);
      offsets.set(c.seat, list);
    }
  }

  const seats: SeatSync[] = usable
    .map(({ seat, r }) => {
      const o = offsets.get(seat) ?? [];
      return {
        seat,
        strokeCount: o.length,
        offsetMs: o.length ? median(o) : 0,
        offsetSpreadMs: o.length ? stdDev(o) : 0,
        strokeRateSpm: r.metrics.strokeRateSpm,
      };
    })
    .filter((s) => s.strokeCount > 0)
    .sort((a, b) => a.seat - b.seat);

  if (seats.length < MIN_SEATS) return { ok: false, reason: "no-strokes" };

  const medians = seats.map((s) => s.offsetMs);
  return {
    ok: true,
    result: {
      seats,
      spreadMs: Math.max(...medians) - Math.min(...medians),
      strokeRateSpm: median(rates),
      pairedStrokes: paired.length,
    },
  };
}

// ─── coaching output ─────────────────────────────────────────────────────────

export type SyncVerdict = "locked-in" | "close" | "loose" | "scattered";

/** Thresholds in milliseconds. Provisional — tune against reviewed crew video. */
const SPREAD_BANDS: Array<{ max: number; verdict: SyncVerdict }> = [
  { max: 40, verdict: "locked-in" },
  { max: 80, verdict: "close" },
  { max: 150, verdict: "loose" },
  { max: Infinity, verdict: "scattered" },
];

export function syncVerdict(spreadMs: number): SyncVerdict {
  return SPREAD_BANDS.find((b) => spreadMs <= b.max)!.verdict;
}

export const SYNC_VERDICT_COPY: Record<SyncVerdict, { label: string; body: string }> = {
  "locked-in": {
    label: "Locked in",
    body: "The crew is catching together within a frame or two of video. This is what a boat that runs feels like.",
  },
  close: {
    label: "Close",
    body: "Nearly together, with a little drift. Tightening this is usually about watching the stroke rather than the water.",
  },
  loose: {
    label: "Loose",
    body: "There's a visible gap between the earliest and latest catch. The boat will be checking slightly on every stroke.",
  },
  scattered: {
    label: "Scattered",
    body: "Seats are catching at noticeably different times, which fights the hull more than it drives it. Worth slowing the rate right down and rebuilding timing.",
  },
};

/** Seats furthest from the crew average, worst first. */
export function worstOffenders(result: TeamSyncResult, limit = 3): SeatSync[] {
  return [...result.seats]
    .sort((a, b) => Math.abs(b.offsetMs) - Math.abs(a.offsetMs))
    .slice(0, limit);
}
