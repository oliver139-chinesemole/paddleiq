// Training plan generation.
//
// The plans advertised 4–12 weeks and shipped with at most one week of content;
// three of the five had none, and the UI said "full week-by-week schedule
// coming soon" without even rendering the week that existed.
//
// Hand-writing ~400 individual sessions would be a lot of fabricated detail I
// couldn't check for consistency. Coaches don't write plans that way either —
// they lay out phases with a weekly shape and a progression, and the concrete
// weeks fall out of that. So a plan is defined as phases here, and the schedule
// is generated. That means progression is a property the whole plan obeys
// rather than something I'd have to get right 400 times by hand.
//
// Pure — no React, no DOM.

import type { DayWorkout, TrainingPlan, WeeklySchedule } from "@/lib/types";

export type Intensity = DayWorkout["intensity"];
export type DayType = DayWorkout["type"];

/** One day's shape within a phase's weekly pattern. */
export interface DayPattern {
  type: DayType;
  name: string;
  description: string;
  /** Duration at the start of the phase; scaled by the week's volume factor. */
  baseMin: number;
  intensity: Intensity;
  strokeRate?: number;
  distanceM?: number;
}

export interface PhaseSpec {
  /** Shown on the week, e.g. "Base" or "Taper". */
  name: string;
  weeks: number;
  /** Seven entries, Monday to Sunday. */
  days: DayPattern[];
  /**
   * Volume growth per week within the phase, as a fraction. 0.08 adds roughly
   * 8% each week. Taper phases use a negative value.
   */
  progression?: number;
  /** Taper weeks cut volume hard while keeping intensity, before a race. */
  taper?: boolean;
}

export interface PlanSpec {
  id: string;
  name: string;
  description: string;
  difficulty: TrainingPlan["difficulty"];
  focus: string[];
  phases: PhaseSpec[];
}

// ─── progression ─────────────────────────────────────────────────────────────

/** Every fourth week backs off. Training adaptation happens during recovery. */
export const DELOAD_EVERY = 4;
export const DELOAD_FACTOR = 0.6;

/**
 * How much of the base volume a given week carries.
 *
 * `weekInPhase` is 1-based. Build phases climb steadily and drop on a deload
 * week; taper phases descend so the athlete arrives at a race fresh.
 */
export function volumeFactor(weekInPhase: number, phase: PhaseSpec): number {
  if (weekInPhase < 1) return 1;

  if (phase.taper) {
    // Roughly -25% per taper week, floored so the last week isn't nothing.
    return Math.max(0.4, 1 - 0.25 * (weekInPhase - 1));
  }

  const growth = 1 + (phase.progression ?? 0) * (weekInPhase - 1);
  const isDeload = weekInPhase % DELOAD_EVERY === 0;
  return isDeload ? growth * DELOAD_FACTOR : growth;
}

/** True when a week is a planned back-off rather than a build. */
export function isDeloadWeek(weekInPhase: number, phase: PhaseSpec): boolean {
  return !phase.taper && weekInPhase % DELOAD_EVERY === 0;
}

// ─── expansion ───────────────────────────────────────────────────────────────

function scaleDuration(baseMin: number, factor: number): number {
  if (baseMin <= 0) return 0; // rest days stay rest days
  // Round to 5 minutes: a plan that says "37 minutes" reads as false precision.
  return Math.max(10, Math.round((baseMin * factor) / 5) * 5);
}

function describe(day: DayPattern, factor: number, deload: boolean): string {
  if (day.type === "rest") return day.description;
  if (deload) return `${day.description} Back off this week — this is a recovery week.`;
  if (factor > 1.15) return `${day.description} Volume is up on earlier weeks; hold the same quality.`;
  return day.description;
}

/** Expands a phase pattern into the concrete weeks it describes. */
export function expandPhase(phase: PhaseSpec, startWeek: number): WeeklySchedule[] {
  const weeks: WeeklySchedule[] = [];

  for (let w = 1; w <= phase.weeks; w++) {
    const factor = volumeFactor(w, phase);
    const deload = isDeloadWeek(w, phase);

    weeks.push({
      week: startWeek + w - 1,
      days: phase.days.map((d, i) => {
        const workout: DayWorkout = {
          day: i + 1,
          type: d.type,
          name: d.name,
          description: describe(d, factor, deload),
          duration_min: scaleDuration(d.baseMin, factor),
          intensity: d.intensity,
        };
        if (d.strokeRate !== undefined) workout.target_stroke_rate = d.strokeRate;
        if (d.distanceM !== undefined) {
          workout.target_distance_m = Math.round((d.distanceM * factor) / 50) * 50;
        }
        return workout;
      }),
    });
  }

  return weeks;
}

/** Builds the full plan, with every week its duration promises. */
export function buildPlan(spec: PlanSpec): TrainingPlan {
  const weekly_schedule: WeeklySchedule[] = [];
  let week = 1;
  for (const phase of spec.phases) {
    weekly_schedule.push(...expandPhase(phase, week));
    week += phase.weeks;
  }

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    duration_weeks: weekly_schedule.length,
    difficulty: spec.difficulty,
    focus: spec.focus,
    weekly_schedule,
  };
}

/**
 * Which week of its own phase a plan week is, 1-based.
 *
 * Needed because deloads repeat within each phase, so "is week 8 a recovery
 * week" depends on where phase boundaries fall, not on the plan-wide number.
 */
export function weekInPhase(spec: PlanSpec, week: number): number {
  let start = 1;
  for (const phase of spec.phases) {
    if (week >= start && week < start + phase.weeks) return week - start + 1;
    start += phase.weeks;
  }
  return 1;
}

/** The phase a given plan week belongs to, for labelling. */
export function phaseForWeek(spec: PlanSpec, week: number): PhaseSpec | null {
  let start = 1;
  for (const phase of spec.phases) {
    if (week >= start && week < start + phase.weeks) return phase;
    start += phase.weeks;
  }
  return null;
}

// ─── validation ──────────────────────────────────────────────────────────────

/** Hard days in a row, the main way a written plan hurts someone. */
export function maxConsecutiveHardDays(days: DayWorkout[]): number {
  let run = 0;
  let worst = 0;
  // Weeks repeat, so the count wraps around the end into the start.
  for (const d of [...days, ...days]) {
    if (d.intensity === "hard" || d.intensity === "max") {
      run++;
      worst = Math.max(worst, run);
    } else {
      run = 0;
    }
  }
  return Math.min(worst, days.length);
}

export function restDayCount(days: DayWorkout[]): number {
  return days.filter((d) => d.type === "rest").length;
}
