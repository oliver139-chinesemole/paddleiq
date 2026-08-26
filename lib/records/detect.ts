/**
 * Working out whether a session set a personal record.
 *
 * The Records page reads db.personalRecords in four places and nothing ever
 * wrote to it. So for a real athlete the entire personal-records feature —
 * five distances across two categories, the improvement counter, the "train to
 * beat your 2k" panel, and the race projections built on top of them — was
 * permanently empty no matter how much they trained. The app tracked PRs in
 * the sense that it had a table for them.
 *
 * All of this is pure so the rules can be tested directly; the Dexie write
 * lives in lib/db/sessions.ts.
 */

/** Distances the app keeps records at, matching the Records page. */
export const PR_DISTANCES = [200, 250, 500, 1000, 2000] as const;

export type PRCategory = "erg" | "water";

export interface PRCandidate {
  category: PRCategory;
  distance_m: number;
  time_sec: number;
  date: string;
}

export interface ExistingPR {
  category: PRCategory;
  distance_m: number;
  time_sec: number;
}

/** What to write when a session beats the record — or replaces a missing one. */
export interface PRUpdate {
  category: PRCategory;
  distance_m: number;
  time_sec: number;
  date: string;
  /** Absent for a first record at this distance. */
  previous_time_sec?: number;
  /** Seconds knocked off. Absent for a first record. */
  improvement_sec?: number;
}

/**
 * A session only counts as a record attempt at an exact standard distance.
 *
 * A 6,000m steady piece is not a record at anything, and a 2,500m interval
 * session is not a 2,500m record — its total time includes the rests. Interval
 * and pyramid work is excluded for that reason: the distance and duration
 * stored describe the whole session, not a continuous effort.
 *
 * Steady work at an exact distance is allowed through. A slow steady 2k simply
 * won't beat anything, so admitting it costs nothing, and refusing it would
 * throw away the genuine 2k an athlete rowed without labelling it a test.
 */
export function isRecordAttempt(session: {
  distance_m?: number;
  duration_sec?: number;
  workout_type?: string;
}): boolean {
  const { distance_m, duration_sec, workout_type } = session;

  if (!distance_m || !duration_sec) return false;
  if (!(duration_sec > 0)) return false;
  if (!(PR_DISTANCES as readonly number[]).includes(distance_m)) return false;
  if (workout_type === "intervals" || workout_type === "pyramid") return false;

  return true;
}

/**
 * Decide whether `candidate` is a new record, given what's already stored.
 *
 * Returns null when it isn't — the caller writes nothing. Ties don't count:
 * matching your best is not beating it, and treating it as a PR would reset
 * the date and report a 0-second improvement.
 */
export function evaluateRecord(
  existing: ExistingPR[],
  candidate: PRCandidate,
): PRUpdate | null {
  if (!(candidate.time_sec > 0) || !(candidate.distance_m > 0)) return null;

  const current = existing.find(
    (p) => p.category === candidate.category && p.distance_m === candidate.distance_m,
  );

  if (!current) {
    return {
      category: candidate.category,
      distance_m: candidate.distance_m,
      time_sec: candidate.time_sec,
      date: candidate.date,
    };
  }

  if (candidate.time_sec >= current.time_sec) return null;

  return {
    category: candidate.category,
    distance_m: candidate.distance_m,
    time_sec: candidate.time_sec,
    date: candidate.date,
    previous_time_sec: current.time_sec,
    // Rounded because a stored time can carry sub-second precision, and
    // "−4.7s improvement" reads as false accuracy for a hand-timed piece.
    improvement_sec: Math.round(current.time_sec - candidate.time_sec),
  };
}

/**
 * Build a candidate from a saved session, or null if it isn't an attempt.
 *
 * Erg and water are kept as separate categories throughout: an erg time and a
 * boat time over the same distance are different events, and merging them
 * would let a machine PR overwrite a water one.
 */
export function candidateFromSession(
  category: PRCategory,
  session: { distance_m?: number; duration_sec?: number; date?: string; workout_type?: string },
): PRCandidate | null {
  if (!isRecordAttempt(session)) return null;
  if (!session.date) return null;

  return {
    category,
    distance_m: session.distance_m!,
    time_sec: session.duration_sec!,
    date: session.date,
  };
}
