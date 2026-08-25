/**
 * Unit tests for the dashboard's headline prompt.
 *
 * The card used to be hardcoded: every athlete saw "4 × 500m Erg Intervals,
 * target split 128–132s/500m · RPE 8" presented as their workout, including
 * someone who had never logged anything. Each branch here is something the app
 * actually knows.
 */
import { describe, it, expect } from "vitest";
import { dashboardPrompt, currentPlanWeek, trainingDayOfWeek } from "../active";

describe("dashboardPrompt", () => {
  it("asks a brand-new athlete for their first session", () => {
    expect(dashboardPrompt(0, null)).toEqual({ kind: "first-session" });
  });

  it("prefers the first session even if a plan is somehow set", () => {
    // Prescribing plan work to someone with no history is the case that was
    // wrong before; having a plan id doesn't change that.
    expect(dashboardPrompt(0, "plan-500m")).toEqual({ kind: "first-session" });
  });

  it("shows the running plan once there's history", () => {
    expect(dashboardPrompt(5, "plan-500m")).toEqual({ kind: "active-plan", planId: "plan-500m" });
  });

  it("suggests picking a plan for an athlete training without one", () => {
    expect(dashboardPrompt(5, null)).toEqual({ kind: "pick-plan" });
  });

  it("always returns a branch the card can render", () => {
    for (const count of [0, 1, 50]) {
      for (const plan of [null, "plan-erg"]) {
        expect(["first-session", "active-plan", "pick-plan"])
          .toContain(dashboardPrompt(count, plan).kind);
      }
    }
  });
});

describe("currentPlanWeek", () => {
  const START = "2026-06-01"; // a Monday
  const on = (iso: string) => new Date(`${iso}T12:00:00`);

  it("is week 1 on the day you start", () => {
    expect(currentPlanWeek(START, 8, on("2026-06-01"))).toBe(1);
  });

  it("stays in week 1 for the first seven days", () => {
    expect(currentPlanWeek(START, 8, on("2026-06-07"))).toBe(1);
  });

  it("rolls into week 2 on day eight", () => {
    expect(currentPlanWeek(START, 8, on("2026-06-08"))).toBe(2);
  });

  it("clamps at the end rather than running off it", () => {
    // A plan left running shows its final week, not a blank card.
    expect(currentPlanWeek(START, 8, on("2027-01-01"))).toBe(8);
  });

  it("copes with no start date, a bad one, or a future one", () => {
    expect(currentPlanWeek(null, 8, on("2026-06-10"))).toBe(1);
    expect(currentPlanWeek("not-a-date", 8, on("2026-06-10"))).toBe(1);
    expect(currentPlanWeek("2026-07-01", 8, on("2026-06-10"))).toBe(1);
  });
});

describe("trainingDayOfWeek", () => {
  it("treats Monday as day 1 and Sunday as day 7", () => {
    // The plans are written Monday-first; getDay() puts Sunday at 0.
    expect(trainingDayOfWeek(new Date("2026-06-01T12:00:00"))).toBe(1); // Monday
    expect(trainingDayOfWeek(new Date("2026-06-06T12:00:00"))).toBe(6); // Saturday
    expect(trainingDayOfWeek(new Date("2026-06-07T12:00:00"))).toBe(7); // Sunday
  });

  it("always lands inside a training week", () => {
    for (let d = 1; d <= 14; d++) {
      const n = trainingDayOfWeek(new Date(`2026-06-${String(d).padStart(2,"0")}T12:00:00`));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(7);
    }
  });
});
