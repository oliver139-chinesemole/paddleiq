import { describe, it, expect } from "vitest";
import { scorePlan, rankPlans, topRecommendation, RECOMMEND_THRESHOLD } from "../recommend";
import { PLAN_SPECS } from "../specs";
import { EMPTY_PREFERENCES, type Preferences } from "@/lib/profile/preferences";
import type { PlanSpec } from "../generate";

const prefs = (p: Partial<Preferences>): Preferences => ({ ...EMPTY_PREFERENCES, ...p });

const plan = (id: string) => PLAN_SPECS.find((s) => s.id === id)!;

describe("scorePlan", () => {
  it("scores nothing when the athlete has said nothing", () => {
    const r = scorePlan(plan("plan-500m"), EMPTY_PREFERENCES);
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it("gives a reason for every point it awards", () => {
    // A recommendation an athlete can't interrogate is one they can't
    // disagree with, and this is a guess about their training.
    const r = scorePlan(plan("plan-500m"), prefs({ preferredDistances: [500], goals: ["race"] }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.join(" ")).toMatch(/500m/);
  });

  it("weights a race distance above a shared training environment", () => {
    const byDistance = scorePlan(plan("plan-200m"), prefs({ preferredDistances: [200] }));
    const byEnv = scorePlan(plan("plan-200m"), prefs({ trainingEnv: ["erg"] }));
    expect(byDistance.score).toBeGreaterThan(byEnv.score);
  });

  it("adds up across several matching answers", () => {
    const one = scorePlan(plan("plan-erg"), prefs({ goals: ["erg_score"] }));
    const two = scorePlan(plan("plan-erg"), prefs({ goals: ["erg_score", "endurance"] }));
    expect(two.score).toBeGreaterThan(one.score);
  });

  it("stays quiet about a role that doesn't distinguish anything", () => {
    // Nearly every plan suits a "paddler"; saying so would be filler.
    const r = scorePlan(plan("plan-erg"), prefs({ role: "paddler" }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons).toEqual([]);
  });

  it("does say so for a beginner", () => {
    const r = scorePlan(plan("plan-beginner"), prefs({ role: "beginner" }));
    expect(r.reasons.join(" ")).toMatch(/new to the sport/i);
  });

  it("scores an unannotated plan at zero rather than treating it as a match", () => {
    const bare = { ...plan("plan-erg"), suits: undefined } as PlanSpec;
    const r = scorePlan(bare, prefs({ goals: ["erg_score"], preferredDistances: [2000] }));
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });
});

describe("rankPlans", () => {
  it("keeps the authored order when nothing is known", () => {
    // A fresh athlete should see the same sensible easiest-first list as
    // before, not an arbitrary shuffle.
    const ranked = rankPlans(PLAN_SPECS, EMPTY_PREFERENCES);
    expect(ranked.map((r) => r.spec.id)).toEqual(PLAN_SPECS.map((s) => s.id));
  });

  it("returns every plan, not just the matching ones", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({ preferredDistances: [200] }));
    expect(ranked).toHaveLength(PLAN_SPECS.length);
  });

  it("puts the sprint plan first for a sprinter", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({
      role: "competitive",
      preferredDistances: [200, 250],
      goals: ["race"],
      trainingEnv: ["team_boat"],
    }));
    expect(ranked[0].spec.id).toBe("plan-200m");
  });

  it("puts the erg plan first for someone chasing a split on an erg", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({
      role: "competitive",
      preferredDistances: [2000],
      goals: ["erg_score"],
      trainingEnv: ["erg"],
    }));
    expect(ranked[0].spec.id).toBe("plan-erg");
  });

  it("puts the foundation plan first for a beginner", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({
      role: "beginner",
      goals: ["technique", "fitness"],
      trainingEnv: ["team_boat"],
    }));
    expect(ranked[0].spec.id).toBe("plan-beginner");
  });

  it("puts the tryout plan first for someone trying to make the team", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({
      goals: ["team"],
      trainingEnv: ["team_boat", "dryland"],
    }));
    expect(ranked[0].spec.id).toBe("plan-tryout");
  });

  it("puts the solo water plan first for a solo paddler", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({
      goals: ["endurance"],
      trainingEnv: ["solo_water"],
      preferredDistances: [2000],
    }));
    expect(ranked[0].spec.id).toBe("plan-timetrial");
  });

  it("sorts by score descending throughout", () => {
    const ranked = rankPlans(PLAN_SPECS, prefs({
      preferredDistances: [500],
      goals: ["race", "erg_score"],
      trainingEnv: ["erg", "team_boat"],
    }));
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("doesn't mutate the plans it was given", () => {
    const before = PLAN_SPECS.map((s) => s.id);
    rankPlans(PLAN_SPECS, prefs({ preferredDistances: [200] }));
    expect(PLAN_SPECS.map((s) => s.id)).toEqual(before);
  });
});

describe("topRecommendation", () => {
  it("recommends nothing to an athlete who has told us nothing", () => {
    // Better to show the plain list than to claim a personalised pick that
    // isn't personalised to anything.
    expect(topRecommendation(PLAN_SPECS, EMPTY_PREFERENCES)).toBeNull();
  });

  it("won't recommend on a single weak signal", () => {
    // One shared training environment is a coincidence, not a match.
    expect(topRecommendation(PLAN_SPECS, prefs({ trainingEnv: ["erg"] }))).toBeNull();
  });

  it("recommends once there's enough to go on", () => {
    const top = topRecommendation(PLAN_SPECS, prefs({
      preferredDistances: [500],
      goals: ["race"],
      trainingEnv: ["team_boat"],
    }));
    expect(top).not.toBeNull();
    expect(top!.spec.id).toBe("plan-500m");
    expect(top!.score).toBeGreaterThanOrEqual(RECOMMEND_THRESHOLD);
    expect(top!.reasons.length).toBeGreaterThan(0);
  });
});

describe("the plan catalogue", () => {
  it("annotates every plan, so none is unrecommendable by omission", () => {
    for (const spec of PLAN_SPECS) {
      expect(spec.suits, `${spec.id} has no suitability metadata`).toBeDefined();
    }
  });

  it("only references goals and environments onboarding actually asks about", () => {
    // A typo here silently makes a plan unmatchable rather than failing.
    const GOALS = ["endurance", "technique", "erg_score", "race", "team", "fitness"];
    const ENV = ["team_boat", "erg", "solo_water", "dryland"];
    const ROLES = ["paddler", "coach", "captain", "beginner", "competitive"];
    const DISTANCES = [200, 250, 500, 1000, 2000];

    for (const spec of PLAN_SPECS) {
      for (const g of spec.suits!.goals) expect(GOALS, `${spec.id}: ${g}`).toContain(g);
      for (const e of spec.suits!.env) expect(ENV, `${spec.id}: ${e}`).toContain(e);
      for (const r of spec.suits!.roles) expect(ROLES, `${spec.id}: ${r}`).toContain(r);
      for (const d of spec.suits!.distances) expect(DISTANCES, `${spec.id}: ${d}`).toContain(d);
    }
  });

  it("can recommend something for every single onboarding goal", () => {
    // Otherwise an athlete picks a goal and the app has nothing to offer.
    for (const goal of ["endurance", "technique", "erg_score", "race", "team", "fitness"]) {
      const ranked = rankPlans(PLAN_SPECS, prefs({ goals: [goal] }));
      expect(ranked[0].score, `no plan matches the goal "${goal}"`).toBeGreaterThan(0);
    }
  });

  it("can recommend something for every race distance", () => {
    for (const d of [200, 250, 500, 1000, 2000]) {
      const ranked = rankPlans(PLAN_SPECS, prefs({ preferredDistances: [d] }));
      expect(ranked[0].score, `no plan matches ${d}m`).toBeGreaterThan(0);
    }
  });
});
