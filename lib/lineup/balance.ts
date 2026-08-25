// Boat trim analysis and auto-balancing.
//
// A dragon boat that lists to one side drags asymmetrically and steers badly,
// and one that sits bow-down or stern-down wastes energy pushing water instead
// of moving through it. Coaches do this arithmetic by hand on paper before
// every race; there is no reason it can't be computed.
//
// Conventions used throughout:
//   - Rows are numbered from the bow: row 1 is the front bench, row N the back.
//   - "Engine room" is the middle of the boat, where the heaviest paddlers
//     belong — weight there sits over the widest part of the hull.
//   - Drummer and steerer are excluded from paddler balance but do count
//     toward fore/aft trim, since they sit at the extreme ends.
//
// Pure functions only — no React, no DB.

import type { SeatAssignment } from "@/lib/types";

export interface Paddler {
  user_id: string;
  full_name: string;
  /** The side this paddler is trained on. */
  paddle_side: string;
  weight_kg?: number | null;
}

export type Side = "left" | "right";

// ─── thresholds ──────────────────────────────────────────────────────────────

/**
 * Side imbalance a crew can absorb without the hull visibly listing. Provisional
 * — coaches vary on this, and it scales somewhat with crew size.
 */
export const SIDE_BALANCE_GOOD_KG = 5;
export const SIDE_BALANCE_OK_KG = 15;

/** Fore/aft split beyond this reads as noticeably bow- or stern-heavy. */
export const TRIM_GOOD_KG = 10;
export const TRIM_OK_KG = 30;

export type BalanceGrade = "good" | "ok" | "poor";

function grade(value: number, good: number, ok: number): BalanceGrade {
  if (value <= good) return "good";
  if (value <= ok) return "ok";
  return "poor";
}

// ─── analysis ────────────────────────────────────────────────────────────────

export interface BalanceReport {
  leftCount: number;
  rightCount: number;
  leftWeightKg: number;
  rightWeightKg: number;
  /** Left minus right. Positive means the boat leans left. */
  sideDiffKg: number;
  sideGrade: BalanceGrade;
  /** Bow half minus stern half. Positive means bow-heavy. */
  trimDiffKg: number;
  trimGrade: BalanceGrade;
  totalWeightKg: number;
  /** Paddlers seated on a side they aren't trained for. */
  offSide: Paddler[];
  /** Seated paddlers with no recorded weight — every number above is a guess without them. */
  missingWeight: Paddler[];
  seatedCount: number;
}

/** Rows in a boat of `boatSize` paddler seats (two per row). */
export function rowCount(boatSize: number): number {
  return Math.max(0, Math.floor(boatSize / 2));
}

/**
 * How far a row sits from the middle of the boat, positive toward the bow.
 *
 * Trim is a moment about the centre, not a bow-half/stern-half tally: in a
 * 10-row boat, rows 5 and 6 are adjacent and should very nearly cancel, where
 * splitting into halves would credit each with its full weight on opposite
 * ends and report a nearly empty boat as wildly out of trim.
 */
export function leverArm(row: number, rows: number): number {
  return (rows + 1) / 2 - row;
}

/** Largest lever arm in the boat — the bow and stern rows. */
function maxArm(rows: number): number {
  return rows > 1 ? (rows - 1) / 2 : 1;
}

function weightOf(p: Paddler | undefined): number {
  return p?.weight_kg ?? 0;
}

export function analyzeBalance(
  assignments: SeatAssignment[],
  paddlers: Paddler[],
  boatSize: number
): BalanceReport {
  const byId = new Map(paddlers.map((p) => [p.user_id, p]));
  const rows = rowCount(boatSize);
  const arm = maxArm(rows);

  let leftCount = 0, rightCount = 0;
  let leftWeightKg = 0, rightWeightKg = 0;
  let moment = 0;
  const offSide: Paddler[] = [];
  const missingWeight: Paddler[] = [];
  let seatedCount = 0;

  for (const a of assignments) {
    if (!a.user_id) continue;
    const p = byId.get(a.user_id);
    if (!p) continue;

    const w = weightOf(p);

    if (a.side === "left" || a.side === "right") {
      seatedCount++;
      if (!p.weight_kg) missingWeight.push(p);
      if (p.paddle_side !== a.side) offSide.push(p);

      if (a.side === "left") { leftCount++; leftWeightKg += w; }
      else { rightCount++; rightWeightKg += w; }
    }

    // Trim counts everyone aboard. Drummer and steerer sit beyond the paddler
    // rows, so they take the full lever arm at each end.
    if (a.seat === "drummer") moment += w * arm;
    else if (a.seat === "steerer") moment -= w * arm;
    else if (typeof a.seat === "number") moment += w * leverArm(a.seat, rows);
  }

  const sideDiffKg = leftWeightKg - rightWeightKg;
  // Re-expressed as the equivalent kilograms sitting at the bow or stern
  // extremes, so the number stays in units a coach can act on.
  const trimDiffKg = arm > 0 ? moment / arm : 0;

  return {
    leftCount,
    rightCount,
    leftWeightKg,
    rightWeightKg,
    sideDiffKg,
    sideGrade: grade(Math.abs(sideDiffKg), SIDE_BALANCE_GOOD_KG, SIDE_BALANCE_OK_KG),
    trimDiffKg,
    trimGrade: grade(Math.abs(trimDiffKg), TRIM_GOOD_KG, TRIM_OK_KG),
    totalWeightKg: leftWeightKg + rightWeightKg,
    offSide,
    missingWeight,
    seatedCount,
  };
}

// ─── auto-balance ────────────────────────────────────────────────────────────

/**
 * Row fill order, heaviest first: closest to the middle of the boat outward.
 *
 * Ordering by absolute lever arm keeps the two halves paired — for an even row
 * count the two centre rows come out together, so a partly crewed boat doesn't
 * end up biased toward the bow. For 5 rows this yields [3, 2, 4, 1, 5].
 */
export function engineRoomOrder(rows: number): number[] {
  if (rows <= 0) return [];
  return Array.from({ length: rows }, (_, i) => i + 1).sort((a, b) => {
    const da = Math.abs(leverArm(a, rows));
    const db = Math.abs(leverArm(b, rows));
    // Equidistant rows: take the bow one first, purely for a stable order.
    return da === db ? a - b : da - db;
  });
}

export interface AutoBalanceResult {
  assignments: SeatAssignment[];
  /** Paddlers who didn't fit — more crew than seats, or a lopsided side split. */
  unseated: Paddler[];
  /** Paddlers placed on their off side to fill the boat. */
  movedOffSide: Paddler[];
}

/**
 * Suggests a lineup: heaviest paddlers in the engine room, sides kept as close
 * in weight as the roster allows, and side preferences respected wherever
 * there are enough paddlers to do so.
 *
 * Deliberately greedy rather than optimal. An exact solution is a bin-packing
 * problem, and a coach is going to hand-adjust the result anyway — what matters
 * is that it starts them from something sensible.
 */
export function autoBalance(
  paddlers: Paddler[],
  boatSize: number,
  opts: { drummer?: Paddler; steerer?: Paddler } = {}
): AutoBalanceResult {
  const rows = rowCount(boatSize);
  const seatsPerSide = rows;

  const excluded = new Set(
    [opts.drummer?.user_id, opts.steerer?.user_id].filter(Boolean) as string[]
  );
  const available = paddlers.filter((p) => !excluded.has(p.user_id));

  const byWeightDesc = (a: Paddler, b: Paddler) => weightOf(b) - weightOf(a);
  const left = available.filter((p) => p.paddle_side === "left").sort(byWeightDesc);
  const right = available.filter((p) => p.paddle_side === "right").sort(byWeightDesc);
  // Anyone without a usable side preference is a floater we can place freely.
  const floaters = available
    .filter((p) => p.paddle_side !== "left" && p.paddle_side !== "right")
    .sort(byWeightDesc);

  const movedOffSide: Paddler[] = [];

  // Even the sides out, drawing on floaters first and only then moving someone
  // off their trained side.
  const takeFiller = (): Paddler | undefined => floaters.shift();
  while (left.length < seatsPerSide && right.length > seatsPerSide) {
    const filler = takeFiller() ?? right.pop();
    if (!filler) break;
    if (filler.paddle_side === "right") movedOffSide.push(filler);
    left.push(filler);
  }
  while (right.length < seatsPerSide && left.length > seatsPerSide) {
    const filler = takeFiller() ?? left.pop();
    if (!filler) break;
    if (filler.paddle_side === "left") movedOffSide.push(filler);
    right.push(filler);
  }
  // Any floaters left over go to whichever side is lighter on numbers.
  while (floaters.length && (left.length < seatsPerSide || right.length < seatsPerSide)) {
    const f = floaters.shift()!;
    if (left.length <= right.length && left.length < seatsPerSide) left.push(f);
    else if (right.length < seatsPerSide) right.push(f);
    else break;
  }

  left.sort(byWeightDesc);
  right.sort(byWeightDesc);

  const order = engineRoomOrder(rows);
  const assignments: SeatAssignment[] = [];

  let leftKg = 0;
  let rightKg = 0;

  for (const row of order) {
    const l = left.shift();
    const r = right.shift();

    // Where one side is heavier so far, give it the lighter of this row's two
    // paddlers. Over a full boat this keeps the running totals converging.
    let forLeft = l;
    let forRight = r;
    if (l && r) {
      const swapImproves =
        Math.abs(leftKg + weightOf(r) - (rightKg + weightOf(l))) <
        Math.abs(leftKg + weightOf(l) - (rightKg + weightOf(r)));
      // Never swap two paddlers who are both already on their trained side —
      // that would trade a few kg of trim for two off-side paddlers.
      const bothOnPreferredSide = l.paddle_side === "left" && r.paddle_side === "right";
      if (swapImproves && !bothOnPreferredSide) {
        forLeft = r;
        forRight = l;
      }
    }

    if (forLeft) {
      assignments.push({ seat: row, side: "left", user_id: forLeft.user_id, name: forLeft.full_name });
      leftKg += weightOf(forLeft);
    }
    if (forRight) {
      assignments.push({ seat: row, side: "right", user_id: forRight.user_id, name: forRight.full_name });
      rightKg += weightOf(forRight);
    }
  }

  if (opts.drummer) {
    assignments.push({
      seat: "drummer", side: "drummer",
      user_id: opts.drummer.user_id, name: opts.drummer.full_name,
    });
  }
  if (opts.steerer) {
    assignments.push({
      seat: "steerer", side: "steerer",
      user_id: opts.steerer.user_id, name: opts.steerer.full_name,
    });
  }

  const seated = new Set(assignments.map((a) => a.user_id));
  const unseated = available.filter((p) => !seated.has(p.user_id));

  return { assignments, unseated, movedOffSide };
}

// ─── copy ────────────────────────────────────────────────────────────────────

export const GRADE_LABEL: Record<BalanceGrade, string> = {
  good: "Balanced",
  ok: "Slightly off",
  poor: "Out of balance",
};

/** One-line summary of which way the boat leans and by how much. */
export function describeSide(r: BalanceReport): string {
  const d = Math.abs(r.sideDiffKg);
  if (d < 0.5) return "Both sides carry the same weight.";
  return `${d.toFixed(1)}kg heavier on the ${r.sideDiffKg > 0 ? "left" : "right"}.`;
}

/** One-line summary of fore/aft trim. */
export function describeTrim(r: BalanceReport): string {
  const d = Math.abs(r.trimDiffKg);
  if (d < 0.5) return "Weight sits evenly bow to stern.";
  return `${d.toFixed(1)}kg heavier in the ${r.trimDiffKg > 0 ? "bow" : "stern"}.`;
}
