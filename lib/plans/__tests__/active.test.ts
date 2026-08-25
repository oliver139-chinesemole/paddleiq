/**
 * Unit tests for the dashboard's headline prompt.
 *
 * The card used to be hardcoded: every athlete saw "4 × 500m Erg Intervals,
 * target split 128–132s/500m · RPE 8" presented as their workout, including
 * someone who had never logged anything. Each branch here is something the app
 * actually knows.
 */
import { describe, it, expect } from "vitest";
import { dashboardPrompt } from "../active";

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
