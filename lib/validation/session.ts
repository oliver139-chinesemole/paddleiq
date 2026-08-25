// Validation for the session log forms.
//
// The forms hold every field as a string and the save handlers parsed them with
// `parseInt(x) || 0`, so an empty form saved a session of 0m in 0s and a typo'd
// "-500" saved a negative distance. Those rows then feed weekly totals, the
// streak, ACWR, PR detection and every chart.
//
// Validation returns a map keyed by form field name rather than throwing, so it
// drops straight into the existing useState forms and can render inline.
//
// Pure — no React, no DOM.

import { z } from "zod";
import { toLocalDateStr } from "@/lib/utils";

/** Field name -> message. Empty means valid. */
export type FieldErrors = Record<string, string>;

// ─── shared pieces ───────────────────────────────────────────────────────────

/** Upper bounds are sanity checks, not sport limits — they catch typos. */
export const LIMITS = {
  maxDistanceM: 100_000,   // 100km in one session
  maxDurationSec: 6 * 3600,
  strokeRate: [20, 150] as const,
  watts: [1, 2000] as const,
  heartRate: [30, 230] as const,
  rpe: [1, 10] as const,
  maxDurationMin: 6 * 60,
};

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

/** Optional numeric field: blank is fine, but a value must be in range. */
function optionalNumber(range: readonly [number, number], label: string) {
  return z.string().refine(
    (v) => {
      if (v.trim() === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= range[0] && n <= range[1];
    },
    { message: `${label} should be between ${range[0]} and ${range[1]}` }
  );
}

/** Turns a ZodError into the flat map the forms consume. */
function toFieldErrors(result: z.ZodSafeParseResult<unknown>): FieldErrors {
  if (result.success) return {};
  const out: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    // Keep the first message per field; later ones are usually consequences.
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * A session can't have happened tomorrow. Worth checking explicitly: the forms
 * used to default to the UTC date, which handed people a future date outright.
 */
function notInFuture(date: string, now: Date): boolean {
  return date <= toLocalDateStr(now);
}

// ─── erg ─────────────────────────────────────────────────────────────────────

export interface ErgFormValues {
  date: string;
  distanceM: string;
  minutes: string;
  seconds: string;
  strokeRate: string;
  watts: string;
  heartRate: string;
  rpe: string;
}

export function validateErgForm(form: ErgFormValues, now = new Date()): FieldErrors {
  const schema = z
    .object({
      date: dateString,
      distanceM: z.string(),
      minutes: z.string(),
      seconds: z.string(),
      strokeRate: optionalNumber(LIMITS.strokeRate, "Stroke rate"),
      watts: optionalNumber(LIMITS.watts, "Watts"),
      heartRate: optionalNumber(LIMITS.heartRate, "Heart rate"),
      rpe: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.date && !notInFuture(v.date, now)) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "That date is in the future" });
      }

      const distance = Number(v.distanceM);
      if (v.distanceM.trim() === "") {
        ctx.addIssue({ code: "custom", path: ["distanceM"], message: "How far did you go?" });
      } else if (!Number.isFinite(distance) || distance <= 0) {
        ctx.addIssue({ code: "custom", path: ["distanceM"], message: "Distance must be more than 0" });
      } else if (distance > LIMITS.maxDistanceM) {
        ctx.addIssue({ code: "custom", path: ["distanceM"], message: "That looks like a typo" });
      }

      const mins = Number(v.minutes || 0);
      const secs = Number(v.seconds || 0);
      const duration = mins * 60 + secs;
      if (!Number.isFinite(duration) || duration <= 0) {
        ctx.addIssue({ code: "custom", path: ["minutes"], message: "How long did it take?" });
      } else if (duration > LIMITS.maxDurationSec) {
        ctx.addIssue({ code: "custom", path: ["minutes"], message: "That looks like a typo" });
      }
      if (secs >= 60) {
        ctx.addIssue({ code: "custom", path: ["seconds"], message: "Seconds should be under 60" });
      }

      const rpe = Number(v.rpe);
      if (!Number.isFinite(rpe) || rpe < LIMITS.rpe[0] || rpe > LIMITS.rpe[1]) {
        ctx.addIssue({ code: "custom", path: ["rpe"], message: "Pick an effort from 1 to 10" });
      }
    });

  return toFieldErrors(schema.safeParse(form));
}

// ─── water ───────────────────────────────────────────────────────────────────

export interface WaterFormValues {
  date: string;
  distanceM: string;
  minutes: string;
  seconds: string;
  strokeRate: string;
  heartRate: string;
  rpe: string;
}

export function validateWaterForm(form: WaterFormValues, now = new Date()): FieldErrors {
  // Same shape as the erg: distance over time, with the same failure modes.
  return validateErgForm({ ...form, watts: "" }, now);
}

// ─── team practice ───────────────────────────────────────────────────────────

export interface TeamFormValues {
  date: string;
  durationMin: string;
  distanceM?: string;
  strokeRate: string;
  rpe: string;
}

export function validateTeamForm(form: TeamFormValues, now = new Date()): FieldErrors {
  const schema = z
    .object({
      date: dateString,
      durationMin: z.string(),
      distanceM: z.string().optional(),
      strokeRate: optionalNumber(LIMITS.strokeRate, "Stroke rate"),
      rpe: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.date && !notInFuture(v.date, now)) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "That date is in the future" });
      }

      const mins = Number(v.durationMin);
      if (v.durationMin.trim() === "") {
        ctx.addIssue({ code: "custom", path: ["durationMin"], message: "How long was practice?" });
      } else if (!Number.isFinite(mins) || mins <= 0) {
        ctx.addIssue({ code: "custom", path: ["durationMin"], message: "Duration must be more than 0" });
      } else if (mins > LIMITS.maxDurationMin) {
        ctx.addIssue({ code: "custom", path: ["durationMin"], message: "That looks like a typo" });
      }

      // Distance is optional for a team practice, but if given it must be real.
      const d = v.distanceM?.trim();
      if (d) {
        const n = Number(d);
        if (!Number.isFinite(n) || n <= 0) {
          ctx.addIssue({ code: "custom", path: ["distanceM"], message: "Distance must be more than 0" });
        } else if (n > LIMITS.maxDistanceM) {
          ctx.addIssue({ code: "custom", path: ["distanceM"], message: "That looks like a typo" });
        }
      }

      const rpe = Number(v.rpe);
      if (!Number.isFinite(rpe) || rpe < LIMITS.rpe[0] || rpe > LIMITS.rpe[1]) {
        ctx.addIssue({ code: "custom", path: ["rpe"], message: "Pick an effort from 1 to 10" });
      }
    });

  return toFieldErrors(schema.safeParse(form));
}

// ─── dryland ─────────────────────────────────────────────────────────────────

export interface DrylandExercise {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
}

export interface DrylandFormValues {
  date: string;
  durationMin: string;
  rpe: string;
  exercises: DrylandExercise[];
}

export function validateDrylandForm(form: DrylandFormValues, now = new Date()): FieldErrors {
  const errors: FieldErrors = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = "Pick a valid date";
  else if (!notInFuture(form.date, now)) errors.date = "That date is in the future";

  const mins = Number(form.durationMin);
  if (form.durationMin.trim() === "") errors.durationMin = "How long was the session?";
  else if (!Number.isFinite(mins) || mins <= 0) errors.durationMin = "Duration must be more than 0";
  else if (mins > LIMITS.maxDurationMin) errors.durationMin = "That looks like a typo";

  const rpe = Number(form.rpe);
  if (!Number.isFinite(rpe) || rpe < LIMITS.rpe[0] || rpe > LIMITS.rpe[1]) {
    errors.rpe = "Pick an effort from 1 to 10";
  }

  // A dryland session with no named exercise is just a duration, which is
  // indistinguishable from an accidental save.
  const named = form.exercises.filter((e) => e.name.trim() !== "");
  if (named.length === 0) errors.exercises = "Add at least one exercise";

  return errors;
}

/** True when nothing failed. */
export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}
