/**
 * Unit tests for session form validation.
 *
 * The cases that matter here are the ones that were previously accepted: an
 * empty form saved a 0m/0s session, and a negative distance saved as-is. Both
 * fed weekly totals, the streak, ACWR and PR detection.
 */
import { describe, it, expect } from "vitest";
import {
  validateErgForm,
  validateWaterForm,
  validateTeamForm,
  validateDrylandForm,
  isValid,
  LIMITS,
  type ErgFormValues,
  type TeamFormValues,
  type DrylandFormValues,
} from "../session";

const NOW = new Date("2026-06-15T12:00:00");
const TODAY = "2026-06-15";

const erg = (o: Partial<ErgFormValues> = {}): ErgFormValues => ({
  date: TODAY, distanceM: "2000", minutes: "8", seconds: "30",
  strokeRate: "72", watts: "", heartRate: "", rpe: "7", ...o,
});

const team = (o: Partial<TeamFormValues> = {}): TeamFormValues => ({
  date: TODAY, durationMin: "90", distanceM: "", strokeRate: "68", rpe: "6", ...o,
});

const dryland = (o: Partial<DrylandFormValues> = {}): DrylandFormValues => ({
  date: TODAY, durationMin: "45", rpe: "6",
  exercises: [{ name: "Pull-ups", sets: "3", reps: "10", weight: "", rpe: "7" }],
  ...o,
});

// ── Erg ──────────────────────────────────────────────────────────────────────

describe("validateErgForm", () => {
  it("accepts a normal session", () => {
    expect(validateErgForm(erg(), NOW)).toEqual({});
    expect(isValid(validateErgForm(erg(), NOW))).toBe(true);
  });

  it("rejects an entirely empty form", () => {
    // Regression: this saved {distance_m: 0, duration_sec: 0} and navigated
    // away as though it had worked.
    const errors = validateErgForm(
      erg({ distanceM: "", minutes: "", seconds: "", strokeRate: "", rpe: "7" }),
      NOW
    );
    expect(isValid(errors)).toBe(false);
    expect(errors.distanceM).toBeTruthy();
    expect(errors.minutes).toBeTruthy();
  });

  it("rejects a negative distance", () => {
    // Regression: -500 saved, and subtracted from the weekly total.
    const errors = validateErgForm(erg({ distanceM: "-500" }), NOW);
    expect(errors.distanceM).toBeTruthy();
  });

  it("rejects zero distance and zero duration", () => {
    expect(validateErgForm(erg({ distanceM: "0" }), NOW).distanceM).toBeTruthy();
    expect(validateErgForm(erg({ minutes: "0", seconds: "0" }), NOW).minutes).toBeTruthy();
  });

  it("accepts a session under a minute", () => {
    expect(validateErgForm(erg({ minutes: "", seconds: "45" }), NOW)).toEqual({});
  });

  it("rejects seconds of 60 or more", () => {
    expect(validateErgForm(erg({ seconds: "60" }), NOW).seconds).toBeTruthy();
  });

  it("catches distance and duration typos", () => {
    expect(validateErgForm(erg({ distanceM: String(LIMITS.maxDistanceM + 1) }), NOW).distanceM).toBeTruthy();
    expect(validateErgForm(erg({ minutes: "999" }), NOW).minutes).toBeTruthy();
  });

  it("rejects a future date", () => {
    expect(validateErgForm(erg({ date: "2026-06-16" }), NOW).date).toBeTruthy();
    expect(validateErgForm(erg({ date: TODAY }), NOW).date).toBeUndefined();
  });

  it("accepts a past date", () => {
    expect(validateErgForm(erg({ date: "2026-05-01" }), NOW)).toEqual({});
  });

  it("rejects a malformed date", () => {
    expect(validateErgForm(erg({ date: "" }), NOW).date).toBeTruthy();
    expect(validateErgForm(erg({ date: "15/06/2026" }), NOW).date).toBeTruthy();
  });

  it("treats the optional fields as optional", () => {
    expect(validateErgForm(erg({ strokeRate: "", watts: "", heartRate: "" }), NOW)).toEqual({});
  });

  it("range-checks the optional fields when they are filled", () => {
    expect(validateErgForm(erg({ strokeRate: "500" }), NOW).strokeRate).toBeTruthy();
    expect(validateErgForm(erg({ heartRate: "5" }), NOW).heartRate).toBeTruthy();
    expect(validateErgForm(erg({ watts: "99999" }), NOW).watts).toBeTruthy();
  });

  it("requires a sensible RPE", () => {
    expect(validateErgForm(erg({ rpe: "0" }), NOW).rpe).toBeTruthy();
    expect(validateErgForm(erg({ rpe: "11" }), NOW).rpe).toBeTruthy();
    expect(validateErgForm(erg({ rpe: "" }), NOW).rpe).toBeTruthy();
  });

  it("reports one message per field, not a pile", () => {
    const errors = validateErgForm(erg({ distanceM: "", minutes: "", rpe: "99" }), NOW);
    for (const v of Object.values(errors)) expect(typeof v).toBe("string");
  });
});

// ── Water ────────────────────────────────────────────────────────────────────

describe("validateWaterForm", () => {
  it("accepts a normal time trial", () => {
    expect(validateWaterForm({
      date: TODAY, distanceM: "5000", minutes: "30", seconds: "0",
      strokeRate: "60", heartRate: "150", rpe: "6",
    }, NOW)).toEqual({});
  });

  it("rejects an empty one", () => {
    const errors = validateWaterForm({
      date: TODAY, distanceM: "", minutes: "", seconds: "",
      strokeRate: "", heartRate: "", rpe: "6",
    }, NOW);
    expect(isValid(errors)).toBe(false);
  });
});

// ── Team ─────────────────────────────────────────────────────────────────────

describe("validateTeamForm", () => {
  it("accepts a practice with no distance recorded", () => {
    expect(validateTeamForm(team(), NOW)).toEqual({});
  });

  it("requires a duration", () => {
    expect(validateTeamForm(team({ durationMin: "" }), NOW).durationMin).toBeTruthy();
    expect(validateTeamForm(team({ durationMin: "0" }), NOW).durationMin).toBeTruthy();
  });

  it("validates distance only when one is given", () => {
    expect(validateTeamForm(team({ distanceM: "" }), NOW)).toEqual({});
    expect(validateTeamForm(team({ distanceM: "8000" }), NOW)).toEqual({});
    expect(validateTeamForm(team({ distanceM: "-1" }), NOW).distanceM).toBeTruthy();
  });

  it("rejects a future date", () => {
    expect(validateTeamForm(team({ date: "2026-07-01" }), NOW).date).toBeTruthy();
  });
});

// ── Dryland ──────────────────────────────────────────────────────────────────

describe("validateDrylandForm", () => {
  it("accepts a session with an exercise", () => {
    expect(validateDrylandForm(dryland(), NOW)).toEqual({});
  });

  it("requires at least one named exercise", () => {
    // Otherwise it's just a duration, indistinguishable from a stray save.
    expect(validateDrylandForm(dryland({ exercises: [] }), NOW).exercises).toBeTruthy();
    expect(validateDrylandForm(dryland({
      exercises: [{ name: "", sets: "3", reps: "10", weight: "", rpe: "7" }],
    }), NOW).exercises).toBeTruthy();
  });

  it("requires a duration", () => {
    expect(validateDrylandForm(dryland({ durationMin: "" }), NOW).durationMin).toBeTruthy();
    expect(validateDrylandForm(dryland({ durationMin: "-5" }), NOW).durationMin).toBeTruthy();
  });

  it("rejects a future date", () => {
    expect(validateDrylandForm(dryland({ date: "2026-12-01" }), NOW).date).toBeTruthy();
  });
});

describe("isValid", () => {
  it("is true only for an empty error map", () => {
    expect(isValid({})).toBe(true);
    expect(isValid({ date: "bad" })).toBe(false);
  });
});
