import { describe, it, expect } from "vitest";
import {
  weeklyGoal,
  goalProgress,
  goalBasisLabel,
  STARTER_GOAL_KM,
  PROGRESSION,
  GOAL_WINDOW_WEEKS,
} from "../weekly-goal";

describe("weeklyGoal", () => {
  it("asks for a little more than the athlete's usual week", () => {
    // Regression: the dashboard showed the same 20km target to a beginner and
    // to a racer, and nobody had chosen it.
    const goal = weeklyGoal([20, 20, 20, 20]);
    expect(goal.basis).toBe("history");
    expect(goal.target_km).toBeCloseTo(22, 1);
  });

  it("uses the median so one huge week doesn't set the bar", () => {
    // A training camp week shouldn't become next month's expectation.
    const steady = weeklyGoal([20, 20, 20, 20]);
    const withCamp = weeklyGoal([20, 20, 20, 60]);
    expect(withCamp.target_km).toBeLessThan(steady.target_km * 1.5);
  });

  it("likewise ignores one week off sick", () => {
    const goal = weeklyGoal([30, 30, 0, 30]);
    expect(goal.target_km).toBeGreaterThan(25);
  });

  it("only looks at the recent window", () => {
    // Last winter's volume shouldn't drive this week's target.
    const goal = weeklyGoal([80, 80, 80, 80, 20, 20, 20, 20]);
    expect(goal.target_km).toBeCloseTo(22, 1);
    expect(goal.weeksUsed).toBe(GOAL_WINDOW_WEEKS);
  });

  it("gives a starter target to someone with no history", () => {
    expect(weeklyGoal([]).basis).toBe("starter");
    expect(weeklyGoal([]).target_km).toBe(STARTER_GOAL_KM);
  });

  it("gives a starter target after only one week", () => {
    // One week is a data point, not a pattern.
    const goal = weeklyGoal([18]);
    expect(goal.basis).toBe("starter");
  });

  it("ignores empty weeks before the athlete started", () => {
    // Someone three weeks in shouldn't be judged against five weeks of zeroes
    // logged before they found the app.
    const goal = weeklyGoal([0, 0, 0, 0, 0, 30, 30, 30]);
    expect(goal.basis).toBe("history");
    expect(goal.target_km).toBeCloseTo(33, 1);
  });

  it("falls back to the starter target for someone returning from a long break", () => {
    // A median of almost nothing would otherwise produce a 0.5km "goal".
    const goal = weeklyGoal([0.4, 0.6, 0.5, 0.4]);
    expect(goal.basis).toBe("starter");
    expect(goal.target_km).toBe(STARTER_GOAL_KM);
  });

  it("rounds to something a person would actually say", () => {
    const goal = weeklyGoal([19.37, 19.37, 19.37, 19.37]);
    expect(goal.target_km * 2 === Math.round(goal.target_km * 2)).toBe(true);
  });

  it("keeps the step small enough to stay in the safe load band", () => {
    // The coach engine flags an acute:chronic ratio much above ~1.3; a target
    // the dashboard urges you toward must not be one the coach warns about.
    const goal = weeklyGoal([25, 25, 25, 25]);
    expect(goal.target_km / 25).toBeLessThanOrEqual(1.3);
    expect(goal.target_km / 25).toBeCloseTo(PROGRESSION, 1);
  });

  it("ignores nonsense weeks rather than producing NaN", () => {
    const goal = weeklyGoal([20, NaN, 20, Infinity, 20, -5]);
    expect(Number.isFinite(goal.target_km)).toBe(true);
    expect(goal.target_km).toBeGreaterThan(0);
  });
});

describe("goalProgress", () => {
  it("reports the share of the target covered", () => {
    expect(goalProgress(11, 22)).toBe(50);
    expect(goalProgress(22, 22)).toBe(100);
  });

  it("clamps so the bar can't overflow", () => {
    expect(goalProgress(40, 22)).toBe(100);
  });

  it("is zero rather than NaN before anything is logged", () => {
    expect(goalProgress(0, 22)).toBe(0);
    expect(goalProgress(5, 0)).toBe(0);
    expect(goalProgress(NaN, 22)).toBe(0);
  });
});

describe("goalBasisLabel", () => {
  it("says where a derived target came from", () => {
    expect(goalBasisLabel(weeklyGoal([20, 20, 20, 20]))).toMatch(/your usual 4-week volume/);
  });

  it("is honest that a starter target isn't personalised yet", () => {
    expect(goalBasisLabel(weeklyGoal([]))).toMatch(/starting target/i);
  });
});
