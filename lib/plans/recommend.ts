/**
 * Ranking training plans against what the athlete told onboarding.
 *
 * Onboarding asks four questions and promises to personalise things with the
 * answers. Until now the plans page listed all eight in a fixed order for
 * everyone, so a beginner who trains only on an erg saw a 200m sprint peaking
 * block first and had no way to tell which of the eight was meant for them.
 *
 * The scoring is intentionally simple and explainable. Every point comes with
 * a sentence saying where it came from, and the UI shows those sentences —
 * a recommendation an athlete can't interrogate is one they can't disagree
 * with, and this is a guess about their training, not a fact about it.
 */

import type { PlanSpec } from "./generate";
import type { Preferences } from "@/lib/profile/preferences";
import { distanceLabel, goalLabel, envLabel } from "@/lib/profile/preferences";

/**
 * Weights. A race distance is the sharpest signal — someone who says they
 * race 200m wants the 200m plan — so it outweighs the rest. Role is the
 * weakest: "paddler" describes most people and separates almost nobody.
 */
const WEIGHTS = {
  distance: 4,
  goal: 3,
  env: 2,
  role: 1,
} as const;

export interface PlanRecommendation {
  spec: PlanSpec;
  score: number;
  /** Human-readable reasons, strongest first. Empty when nothing matched. */
  reasons: string[];
}

/**
 * Score one plan. Returns 0 with no reasons when the plan carries no
 * suitability metadata, so an unannotated plan sorts below annotated ones
 * rather than appearing to be a perfect match for everyone.
 */
export function scorePlan(spec: PlanSpec, prefs: Preferences): PlanRecommendation {
  const suits = spec.suits;
  if (!suits) return { spec, score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  const matchedDistances = prefs.preferredDistances.filter((d) => suits.distances.includes(d));
  if (matchedDistances.length > 0) {
    score += WEIGHTS.distance * matchedDistances.length;
    reasons.push(`You race ${matchedDistances.map(distanceLabel).join(" and ")}`);
  }

  const matchedGoals = prefs.goals.filter((g) => suits.goals.includes(g));
  if (matchedGoals.length > 0) {
    score += WEIGHTS.goal * matchedGoals.length;
    reasons.push(`Works on ${matchedGoals.map((g) => goalLabel(g).toLowerCase()).join(" and ")}`);
  }

  const matchedEnv = prefs.trainingEnv.filter((e) => suits.env.includes(e));
  if (matchedEnv.length > 0) {
    score += WEIGHTS.env * matchedEnv.length;
    reasons.push(`Fits training on ${matchedEnv.map((e) => envLabel(e).toLowerCase()).join(" and ")}`);
  }

  if (prefs.role && suits.roles.includes(prefs.role)) {
    score += WEIGHTS.role;
    // Only worth saying out loud when it's a distinguishing role. "Paddler"
    // matches nearly every plan and reads as filler.
    if (prefs.role === "beginner") reasons.push("Written for people new to the sport");
    else if (prefs.role === "coach" || prefs.role === "captain") reasons.push("Suits a squad leader");
  }

  return { spec, score, reasons };
}

/**
 * Rank every plan for this athlete.
 *
 * Ties keep the original order, which is authored roughly easiest-first, so
 * an athlete with no preferences sees the same sensible list as before rather
 * than an arbitrary shuffle.
 */
export function rankPlans(specs: PlanSpec[], prefs: Preferences): PlanRecommendation[] {
  return specs
    .map((spec, index) => ({ ...scorePlan(spec, prefs), index }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map(({ spec, score, reasons }) => ({ spec, score, reasons }));
}

/**
 * A plan needs to clear this to be presented as "recommended for you".
 *
 * One weak signal — a shared training environment, say — isn't a
 * recommendation, it's a coincidence. Requiring more than that keeps the app
 * from claiming a personalised pick it can't actually justify.
 */
export const RECOMMEND_THRESHOLD = 5;

/** The best plan for this athlete, or null if nothing scored well enough. */
export function topRecommendation(
  specs: PlanSpec[],
  prefs: Preferences,
): PlanRecommendation | null {
  const [best] = rankPlans(specs, prefs);
  if (!best || best.score < RECOMMEND_THRESHOLD) return null;
  return best;
}
