/**
 * Unit tests for training plan generation.
 *
 * Two jobs. The first is that the generator behaves — every plan produces the
 * weeks it advertises, volume progresses and then tapers. The second is that
 * the plan *content* is safe: these are instructions a real athlete follows, so
 * a week with no rest day, or four hard days back to back, is a defect in the
 * plan rather than in the code. Those assertions run over the shipped specs.
 */
import { describe, it, expect } from "vitest";
import { planProgressPercent } from "../active";
import {
  volumeFactor,
  isDeloadWeek,
  expandPhase,
  buildPlan,
  phaseForWeek,
  maxConsecutiveHardDays,
  restDayCount,
  DELOAD_EVERY,
  type PhaseSpec,
} from "../generate";
import { PLAN_SPECS } from "../specs";

const REST_DAY = {
  type: "rest" as const, name: "Rest", description: "Rest.",
  baseMin: 0, intensity: "easy" as const,
};

const phase = (o: Partial<PhaseSpec> = {}): PhaseSpec => ({
  name: "Build",
  weeks: 4,
  progression: 0.1,
  days: Array.from({ length: 7 }, (_, i) =>
    i % 3 === 0 ? REST_DAY : { ...REST_DAY, type: "erg" as const, name: "Erg", baseMin: 40, intensity: "moderate" as const }
  ),
  ...o,
});

// ── Progression ──────────────────────────────────────────────────────────────

describe("volumeFactor", () => {
  it("starts at the base volume", () => {
    expect(volumeFactor(1, phase())).toBeCloseTo(1, 5);
  });

  it("grows across a build phase", () => {
    const p = phase({ progression: 0.1 });
    expect(volumeFactor(2, p)).toBeGreaterThan(volumeFactor(1, p));
    expect(volumeFactor(3, p)).toBeGreaterThan(volumeFactor(2, p));
  });

  it("backs off on every fourth week", () => {
    // Adaptation happens during recovery, so a plan that only ever climbs is
    // a plan that breaks people.
    const p = phase({ weeks: 8, progression: 0.1 });
    expect(volumeFactor(DELOAD_EVERY, p)).toBeLessThan(volumeFactor(DELOAD_EVERY - 1, p));
    expect(isDeloadWeek(DELOAD_EVERY, p)).toBe(true);
    expect(isDeloadWeek(DELOAD_EVERY - 1, p)).toBe(false);
  });

  it("descends through a taper and never reaches zero", () => {
    const t = phase({ taper: true, weeks: 3 });
    expect(volumeFactor(2, t)).toBeLessThan(volumeFactor(1, t));
    expect(volumeFactor(3, t)).toBeLessThan(volumeFactor(2, t));
    expect(volumeFactor(10, t)).toBeGreaterThan(0.3);
  });

  it("has no deload weeks during a taper", () => {
    expect(isDeloadWeek(4, phase({ taper: true }))).toBe(false);
  });

  it("handles a nonsense week number", () => {
    expect(volumeFactor(0, phase())).toBe(1);
    expect(volumeFactor(-2, phase())).toBe(1);
  });
});

// ── Expansion ────────────────────────────────────────────────────────────────

describe("expandPhase", () => {
  it("produces one week per phase week, numbered from the start", () => {
    const weeks = expandPhase(phase({ weeks: 3 }), 5);
    expect(weeks.map((w) => w.week)).toEqual([5, 6, 7]);
  });

  it("gives every week seven days", () => {
    for (const w of expandPhase(phase(), 1)) expect(w.days).toHaveLength(7);
  });

  it("keeps rest days at zero minutes however the volume scales", () => {
    for (const w of expandPhase(phase({ weeks: 6, progression: 0.2 }), 1)) {
      for (const d of w.days) {
        if (d.type === "rest") expect(d.duration_min).toBe(0);
      }
    }
  });

  it("rounds durations to something a human would write", () => {
    for (const w of expandPhase(phase({ progression: 0.07 }), 1)) {
      for (const d of w.days) {
        if (d.duration_min > 0) expect(d.duration_min % 5).toBe(0);
      }
    }
  });

  it("says so on a recovery week rather than leaving it unexplained", () => {
    const weeks = expandPhase(phase({ weeks: 4 }), 1);
    const deload = weeks[DELOAD_EVERY - 1];
    const worked = deload.days.find((d) => d.type !== "rest")!;
    expect(worked.description).toMatch(/recovery week/i);
  });
});

// ── Whole plans ──────────────────────────────────────────────────────────────

describe("buildPlan", () => {
  it("numbers weeks continuously across phases", () => {
    const plan = buildPlan(PLAN_SPECS[1]);
    expect(plan.weekly_schedule.map((w) => w.week))
      .toEqual(plan.weekly_schedule.map((_, i) => i + 1));
  });

  it("reports the duration it actually contains", () => {
    for (const spec of PLAN_SPECS) {
      const plan = buildPlan(spec);
      const declared = spec.phases.reduce((n, p) => n + p.weeks, 0);
      expect(plan.duration_weeks, spec.name).toBe(declared);
      expect(plan.weekly_schedule, spec.name).toHaveLength(declared);
    }
  });

  it("finds the phase a week belongs to", () => {
    const spec = PLAN_SPECS[1];
    expect(phaseForWeek(spec, 1)?.name).toBe(spec.phases[0].name);
    expect(phaseForWeek(spec, 999)).toBeNull();
  });
});

// ── The shipped plans, as training advice ────────────────────────────────────

describe("the shipped plans", () => {
  it("covers all eight the landing page advertises", () => {
    // Regression: the marketing named eight; five existed, and three of those
    // had no schedule at all.
    expect(PLAN_SPECS).toHaveLength(8);
    expect(new Set(PLAN_SPECS.map((p) => p.id)).size).toBe(8);
  });

  it("gives every plan a full schedule", () => {
    for (const spec of PLAN_SPECS) {
      const plan = buildPlan(spec);
      expect(plan.weekly_schedule.length, spec.name).toBeGreaterThan(0);
      expect(plan.duration_weeks, spec.name).toBeGreaterThanOrEqual(4);
    }
  });

  it("gives every week at least one full rest day", () => {
    for (const spec of PLAN_SPECS) {
      for (const w of buildPlan(spec).weekly_schedule) {
        expect(restDayCount(w.days), `${spec.name} week ${w.week}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("never stacks more than two hard days in a row", () => {
    // Counted across the week boundary too, since weeks repeat — three hard
    // days running is how a written plan injures someone.
    for (const spec of PLAN_SPECS) {
      for (const w of buildPlan(spec).weekly_schedule) {
        expect(maxConsecutiveHardDays(w.days), `${spec.name} week ${w.week}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("writes a name and a description for every session", () => {
    for (const spec of PLAN_SPECS) {
      for (const w of buildPlan(spec).weekly_schedule) {
        for (const d of w.days) {
          expect(d.name.length, spec.name).toBeGreaterThan(2);
          expect(d.description.length, `${spec.name} ${d.name}`).toBeGreaterThan(15);
        }
      }
    }
  });

  it("keeps every session a plausible length", () => {
    for (const spec of PLAN_SPECS) {
      for (const w of buildPlan(spec).weekly_schedule) {
        for (const d of w.days) {
          expect(d.duration_min, `${spec.name} ${d.name}`).toBeGreaterThanOrEqual(0);
          expect(d.duration_min, `${spec.name} ${d.name}`).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it("ends every race plan on a taper rather than a peak", () => {
    for (const id of ["plan-500m", "plan-200m", "plan-tryout"]) {
      const spec = PLAN_SPECS.find((p) => p.id === id)!;
      expect(spec.phases[spec.phases.length - 1].taper, id).toBe(true);
    }
  });
});

describe("planProgressPercent", () => {
  const start = "2026-06-01";
  const at = (iso: string) => new Date(`${iso}T12:00:00`);

  it("is zero on day one — nothing has been done yet", () => {
    expect(planProgressPercent(start, 6, at("2026-06-01"))).toBe(0);
  });

  it("moves during a week rather than jumping every Monday", () => {
    // The bar used to be a hardcoded 15% regardless of the actual week.
    const midweek = planProgressPercent(start, 6, at("2026-06-04"));
    const later = planProgressPercent(start, 6, at("2026-06-06"));
    expect(midweek).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(midweek);
  });

  it("reaches about half way at the half way point", () => {
    // 6 weeks = 42 days; day 21 is halfway.
    expect(planProgressPercent(start, 6, at("2026-06-22"))).toBe(50);
  });

  it("clamps at 100 for a plan left running past its end", () => {
    expect(planProgressPercent(start, 6, at("2026-12-01"))).toBe(100);
  });

  it("stays at zero before the start date", () => {
    expect(planProgressPercent(start, 6, at("2026-05-20"))).toBe(0);
  });

  it("handles missing or nonsense input without producing NaN", () => {
    expect(planProgressPercent(null, 6)).toBe(0);
    expect(planProgressPercent("not-a-date", 6)).toBe(0);
    expect(planProgressPercent(start, 0)).toBe(0);
  });
});
