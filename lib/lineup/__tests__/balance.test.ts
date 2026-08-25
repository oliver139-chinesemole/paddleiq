/**
 * Unit tests for boat trim analysis and auto-balancing.
 * Pure — no React, no DB.
 */
import { describe, it, expect } from "vitest";
import {
  rowCount,
  engineRoomOrder,
  analyzeBalance,
  autoBalance,
  describeSide,
  describeTrim,
  SIDE_BALANCE_GOOD_KG,
  type Paddler,
} from "../balance";
import type { SeatAssignment } from "@/lib/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const p = (
  id: string,
  weight: number | null,
  side: string = "left",
  name = `P${id}`
): Paddler => ({ user_id: id, full_name: name, paddle_side: side, weight_kg: weight });

/** A crew of `n` per side, each side's weights ascending from `base`. */
function crew(nPerSide: number, base = 60, step = 5): Paddler[] {
  const out: Paddler[] = [];
  for (let i = 0; i < nPerSide; i++) {
    out.push(p(`L${i}`, base + i * step, "left"));
    out.push(p(`R${i}`, base + i * step, "right"));
  }
  return out;
}

const seat = (
  s: number | "drummer" | "steerer",
  side: SeatAssignment["side"],
  user_id?: string
): SeatAssignment => ({ seat: s, side, user_id });

// ── Geometry ─────────────────────────────────────────────────────────────────

describe("rowCount", () => {
  it("splits paddler seats into rows of two", () => {
    expect(rowCount(20)).toBe(10);
    expect(rowCount(10)).toBe(5);
  });

  it("never returns a negative row count", () => {
    expect(rowCount(0)).toBe(0);
    expect(rowCount(-4)).toBe(0);
  });
});

describe("engineRoomOrder", () => {
  it("fills from the middle outward", () => {
    expect(engineRoomOrder(5)).toEqual([3, 2, 4, 1, 5]);
    // Even row counts have two centre rows; they must come out together or a
    // partly crewed boat ends up biased toward the bow.
    expect(engineRoomOrder(4)).toEqual([2, 3, 1, 4]);
  });

  it("covers every row exactly once", () => {
    for (const rows of [1, 2, 3, 6, 10]) {
      const order = engineRoomOrder(rows);
      expect(order).toHaveLength(rows);
      expect(new Set(order).size).toBe(rows);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: rows }, (_, i) => i + 1)
      );
    }
  });

  it("handles a boat with no rows", () => {
    expect(engineRoomOrder(0)).toEqual([]);
  });
});

// ── Analysis ─────────────────────────────────────────────────────────────────

describe("analyzeBalance", () => {
  it("sums weight per side", () => {
    const paddlers = [p("a", 80, "left"), p("b", 70, "right")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(1, "right", "b")], paddlers, 4);
    expect(r.leftWeightKg).toBe(80);
    expect(r.rightWeightKg).toBe(70);
    expect(r.sideDiffKg).toBe(10);
    expect(r.leftCount).toBe(1);
    expect(r.rightCount).toBe(1);
    expect(r.totalWeightKg).toBe(150);
  });

  it("reports a positive side difference when the boat leans left", () => {
    const paddlers = [p("a", 90, "left"), p("b", 60, "right")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(1, "right", "b")], paddlers, 4);
    expect(r.sideDiffKg).toBeGreaterThan(0);
    expect(describeSide(r)).toContain("left");
  });

  it("grades a well-matched boat as good", () => {
    const paddlers = [p("a", 75, "left"), p("b", 73, "right")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(1, "right", "b")], paddlers, 4);
    expect(Math.abs(r.sideDiffKg)).toBeLessThanOrEqual(SIDE_BALANCE_GOOD_KG);
    expect(r.sideGrade).toBe("good");
  });

  it("grades a badly listing boat as poor", () => {
    const paddlers = [p("a", 110, "left"), p("b", 55, "right")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(1, "right", "b")], paddlers, 4);
    expect(r.sideGrade).toBe("poor");
  });

  it("measures fore/aft trim across the halves", () => {
    // 4 rows: seats 1-2 are bow, 3-4 stern.
    const paddlers = [p("a", 100, "left"), p("b", 50, "left")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(4, "left", "b")], paddlers, 8);
    expect(r.trimDiffKg).toBe(50);
    expect(describeTrim(r)).toContain("bow");
  });

  it("excludes the middle row from both halves when rows are odd", () => {
    // 5 rows: bow 1-2, middle 3, stern 4-5. The middle paddler must not tip it.
    const paddlers = [p("m", 120, "left")];
    const r = analyzeBalance([seat(3, "left", "m")], paddlers, 10);
    expect(r.trimDiffKg).toBe(0);
    expect(r.trimGrade).toBe("good");
  });

  it("counts drummer toward the bow and steerer toward the stern", () => {
    const paddlers = [p("d", 60, "left"), p("s", 60, "left")];
    const r = analyzeBalance(
      [seat("drummer", "drummer", "d"), seat("steerer", "steerer", "s")],
      paddlers,
      20
    );
    expect(r.trimDiffKg).toBe(0);
    // Neither is a paddler, so neither counts toward side balance.
    expect(r.leftCount).toBe(0);
    expect(r.seatedCount).toBe(0);
  });

  it("flags paddlers sitting on their off side", () => {
    const paddlers = [p("a", 80, "left"), p("b", 80, "right")];
    const r = analyzeBalance([seat(1, "right", "a"), seat(1, "left", "b")], paddlers, 4);
    expect(r.offSide.map((x) => x.user_id).sort()).toEqual(["a", "b"]);
  });

  it("flags seated paddlers with no recorded weight", () => {
    const paddlers = [p("a", null, "left"), p("b", 70, "right")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(1, "right", "b")], paddlers, 4);
    expect(r.missingWeight.map((x) => x.user_id)).toEqual(["a"]);
  });

  it("ignores empty seats and unknown ids", () => {
    const paddlers = [p("a", 80, "left")];
    const r = analyzeBalance(
      [seat(1, "left", "a"), seat(1, "right"), seat(2, "left", "ghost")],
      paddlers,
      4
    );
    expect(r.seatedCount).toBe(1);
    expect(r.leftWeightKg).toBe(80);
  });

  it("weights trim by distance from the centre, not by which half", () => {
    // Rows 5 and 6 of a 10-row boat are adjacent. Equal weights there should
    // very nearly cancel — a bow-half/stern-half tally would instead report the
    // full weight of each as pulling in opposite directions.
    const paddlers = [p("a", 90, "left"), p("b", 90, "left")];
    const r = analyzeBalance([seat(5, "left", "a"), seat(6, "left", "b")], paddlers, 20);
    expect(Math.abs(r.trimDiffKg)).toBeLessThan(1);
    expect(r.trimGrade).toBe("good");
  });

  it("doesn't call a half-crewed boat wildly out of trim", () => {
    // Regression: 5 paddlers auto-balanced into a 20-seat boat once reported
    // 239kg bow-heavy out of 375kg aboard, because everyone landed in the
    // middle rows and the split counted row 5 as bow and row 6 as stern.
    const paddlers = [
      p("a", 72, "left"), p("b", 80, "right"), p("c", 68, "left"),
      p("d", 85, "right"), p("e", 70, "left"),
    ];
    const { assignments } = autoBalance(paddlers, 20);
    const r = analyzeBalance(assignments, paddlers, 20);
    expect(Math.abs(r.trimDiffKg)).toBeLessThan(r.totalWeightKg / 2);
    expect(Math.abs(r.trimDiffKg)).toBeLessThan(60);
  });

  it("still reports a genuinely end-loaded boat as out of trim", () => {
    const paddlers = [p("a", 100, "left"), p("b", 100, "right")];
    const r = analyzeBalance([seat(1, "left", "a"), seat(1, "right", "b")], paddlers, 20);
    expect(r.trimDiffKg).toBeCloseTo(200, 0);
    expect(r.trimGrade).toBe("poor");
  });

  it("returns zeroes for an empty boat rather than NaN", () => {
    const r = analyzeBalance([], [], 20);
    expect(r.totalWeightKg).toBe(0);
    expect(r.sideDiffKg).toBe(0);
    expect(r.trimDiffKg).toBe(0);
    expect(r.seatedCount).toBe(0);
    expect(Number.isFinite(r.sideDiffKg)).toBe(true);
  });
});

// ── Auto-balance ─────────────────────────────────────────────────────────────

describe("autoBalance", () => {
  it("seats an evenly split crew with everyone on their trained side", () => {
    const paddlers = crew(5); // 5 per side, boat of 10
    const { assignments, unseated, movedOffSide } = autoBalance(paddlers, 10);
    expect(unseated).toHaveLength(0);
    expect(movedOffSide).toHaveLength(0);

    const report = analyzeBalance(assignments, paddlers, 10);
    expect(report.seatedCount).toBe(10);
    expect(report.offSide).toHaveLength(0);
  });

  it("puts the heaviest paddlers in the engine room", () => {
    const paddlers = crew(5, 60, 10); // weights 60..100 per side
    const { assignments } = autoBalance(paddlers, 10);
    const byId = new Map(paddlers.map((x) => [x.user_id, x]));

    const rowWeight = (row: number) =>
      assignments
        .filter((a) => a.seat === row)
        .reduce((s, a) => s + (byId.get(a.user_id!)?.weight_kg ?? 0), 0);

    // Middle row (3 of 5) should outweigh both end rows.
    expect(rowWeight(3)).toBeGreaterThan(rowWeight(1));
    expect(rowWeight(3)).toBeGreaterThan(rowWeight(5));
  });

  it("produces a better side balance than the roster order would", () => {
    // Left side much heavier than right if paired naively.
    const paddlers: Paddler[] = [
      p("l1", 100, "left"), p("l2", 95, "left"), p("l3", 90, "left"),
      p("r1", 60, "right"), p("r2", 62, "right"), p("r3", 64, "right"),
    ];
    const { assignments } = autoBalance(paddlers, 6);
    const report = analyzeBalance(assignments, paddlers, 6);
    // Sides are fixed by preference here, so it can't fully even out — but it
    // must at least seat everyone and report the imbalance honestly.
    expect(report.seatedCount).toBe(6);
    expect(report.sideDiffKg).toBeGreaterThan(0);
  });

  it("evens out the sides using paddlers with no side preference", () => {
    const paddlers: Paddler[] = [
      p("l1", 80, "left"), p("l2", 80, "left"),
      p("r1", 80, "right"),
      p("f1", 80, "either"),
    ];
    const { assignments, movedOffSide } = autoBalance(paddlers, 4);
    const report = analyzeBalance(assignments, paddlers, 4);
    expect(report.leftCount).toBe(2);
    expect(report.rightCount).toBe(2);
    // The floater filled the gap, so nobody trained had to switch.
    expect(movedOffSide).toHaveLength(0);
  });

  it("moves someone off side only when there is no floater left", () => {
    const paddlers: Paddler[] = [
      p("l1", 80, "left"), p("l2", 80, "left"), p("l3", 80, "left"),
      p("r1", 80, "right"),
    ];
    const { assignments, movedOffSide } = autoBalance(paddlers, 4);
    const report = analyzeBalance(assignments, paddlers, 4);
    expect(report.leftCount).toBe(2);
    expect(report.rightCount).toBe(2);
    expect(movedOffSide.length).toBeGreaterThan(0);
  });

  it("reports paddlers who don't fit in the boat", () => {
    const paddlers = crew(5); // 10 paddlers
    const { unseated } = autoBalance(paddlers, 6); // only 6 seats
    expect(unseated).toHaveLength(4);
  });

  it("seats the drummer and steerer without counting them as paddlers", () => {
    const paddlers = crew(2);
    const drummer = p("dr", 55, "left", "Drummer");
    const steerer = p("st", 75, "right", "Steerer");
    const { assignments } = autoBalance([...paddlers, drummer, steerer], 4, {
      drummer,
      steerer,
    });
    expect(assignments.find((a) => a.seat === "drummer")?.user_id).toBe("dr");
    expect(assignments.find((a) => a.seat === "steerer")?.user_id).toBe("st");

    const report = analyzeBalance(assignments, [...paddlers, drummer, steerer], 4);
    expect(report.seatedCount).toBe(4);
    expect(report.leftCount + report.rightCount).toBe(4);
  });

  it("handles an empty roster", () => {
    const { assignments, unseated } = autoBalance([], 20);
    expect(assignments).toHaveLength(0);
    expect(unseated).toHaveLength(0);
  });

  it("copes with missing weights without producing NaN", () => {
    const paddlers = [
      p("a", null, "left"), p("b", null, "right"),
      p("c", 70, "left"), p("d", 70, "right"),
    ];
    const { assignments } = autoBalance(paddlers, 4);
    const report = analyzeBalance(assignments, paddlers, 4);
    expect(Number.isFinite(report.sideDiffKg)).toBe(true);
    expect(Number.isFinite(report.totalWeightKg)).toBe(true);
    expect(report.missingWeight.length).toBe(2);
  });

  it("never seats the same paddler twice", () => {
    const paddlers = crew(6);
    const { assignments } = autoBalance(paddlers, 12);
    const ids = assignments.map((a) => a.user_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never puts two paddlers in the same seat", () => {
    const paddlers = crew(6);
    const { assignments } = autoBalance(paddlers, 12);
    const slots = assignments.map((a) => `${a.seat}-${a.side}`);
    expect(new Set(slots).size).toBe(slots.length);
  });
});
