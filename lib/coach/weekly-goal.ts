/**
 * How far the athlete should aim to paddle this week.
 *
 * The dashboard showed "18.5 / 20 km" under the heading "Weekly Distance
 * Goal". The 20 was a module constant — the same target for a beginner in
 * their first month and a competitive racer peaking for a 500m, and a goal
 * nobody had chosen. As a progress bar it measured distance against an
 * arbitrary number, which is worse than showing no bar at all: it tells some
 * athletes they're failing and others they're done by Tuesday.
 *
 * A target derived from the athlete's own recent weeks is a real one. The
 * rules below are the conventional ones for building volume safely, and they
 * agree with the acute:chronic ratio the coach engine already uses — so the
 * dashboard can't be urging someone toward a week the coach would flag.
 */

/** Weeks of history to look at. Four is also the ACWR chronic window. */
export const GOAL_WINDOW_WEEKS = 4;

/**
 * How much more than recent typical volume to aim for. The 10% step is the
 * long-standing rule of thumb for adding volume without inviting injury, and
 * keeps the acute:chronic ratio comfortably inside its safe band.
 */
export const PROGRESSION = 1.1;

/** Below this many completed weeks there isn't a pattern to build on. */
const MIN_WEEKS_FOR_HISTORY = 2;

/**
 * Shown to someone with no history yet. Deliberately modest: a target that
 * can be met in the first week is an invitation to continue, and it will be
 * replaced by something real as soon as there are two weeks to look at.
 */
export const STARTER_GOAL_KM = 10;

export interface WeeklyGoal {
  /** Target in kilometres, rounded to something a person would say. */
  target_km: number;
  /** Where the number came from, so the UI can say. */
  basis: "history" | "starter";
  /** Completed weeks the target was built from. */
  weeksUsed: number;
}

/** Round to the nearest half kilometre — "21.5 km" reads as a target, "21.37" doesn't. */
function toHalfKm(km: number): number {
  return Math.round(km * 2) / 2;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Work out this week's target from previous completed weeks.
 *
 * `completedWeeks` is in kilometres, oldest first, and must not include the
 * week in progress — a target derived partly from a week that's only two days
 * old would drop every Monday and climb through the weekend.
 *
 * The median is used rather than the mean so that one enormous training camp
 * week, or one week off sick, doesn't set the bar for the next month.
 */
export function weeklyGoal(completedWeeks: number[]): WeeklyGoal {
  const usable = completedWeeks.filter((km) => Number.isFinite(km) && km >= 0);

  // Leading zeroes are "hadn't started yet", not "rested". Counting them drags
  // the target down for someone who has been training for three weeks and had
  // five empty ones in the app before that.
  const firstActive = usable.findIndex((km) => km > 0);
  const history = firstActive === -1 ? [] : usable.slice(firstActive);

  const recent = history.slice(-GOAL_WINDOW_WEEKS);

  if (recent.length < MIN_WEEKS_FOR_HISTORY) {
    return { target_km: STARTER_GOAL_KM, basis: "starter", weeksUsed: recent.length };
  }

  const typical = median(recent);

  // Someone returning after a long break has a median of nearly nothing; the
  // starter target is a kinder and more useful number than 0.5km.
  if (typical * PROGRESSION < STARTER_GOAL_KM) {
    return { target_km: STARTER_GOAL_KM, basis: "starter", weeksUsed: recent.length };
  }

  return {
    target_km: toHalfKm(typical * PROGRESSION),
    basis: "history",
    weeksUsed: recent.length,
  };
}

/** Percentage of the target covered so far, clamped so the bar can't overflow. */
export function goalProgress(done_km: number, target_km: number): number {
  if (!(target_km > 0) || !Number.isFinite(done_km) || done_km <= 0) return 0;
  return Math.min(100, Math.round((done_km / target_km) * 100));
}

/** One line explaining where the target came from. */
export function goalBasisLabel(goal: WeeklyGoal): string {
  return goal.basis === "history"
    ? `10% above your usual ${goal.weeksUsed}-week volume`
    : "A starting target — it adapts once you've logged a few weeks";
}
