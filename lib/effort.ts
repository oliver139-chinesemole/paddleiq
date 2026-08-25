// Effort levels for session logging.
//
// The forms asked for RPE on a 1–10 scale, which is what sports science uses
// but is more precision than anyone actually has. Nobody can honestly tell a 6
// from a 7 mid-session; they guess, and a guess dressed as a 10-point reading
// is worse than a coarse answer given confidently.
//
// So the picker offers five levels, each anchored to something observable —
// how well you can talk is the standard field test for intensity, and it's a
// question an athlete can answer.
//
// The *stored* value stays on the 10-point scale. Training load is RPE ×
// duration, and ACWR compares this week against a four-week baseline, so
// changing the stored units would break both the maths and every session
// already logged. The five levels map onto the even values, which land exactly
// on the bands rpeLabel() already used.

export interface EffortLevel {
  /** What the athlete picks, 1–5. */
  level: number;
  /** What gets stored, on the 1–10 scale the load maths expects. */
  stored: number;
  label: string;
  /** An observable cue, so the question is answerable. */
  cue: string;
  color: string;
}

export const EFFORT_LEVELS: readonly EffortLevel[] = [
  { level: 1, stored: 2,  label: "Easy",      cue: "Could hold a conversation the whole way",  color: "#10B981" },
  { level: 2, stored: 4,  label: "Moderate",  cue: "Breathing harder, still talking in sentences", color: "#84CC16" },
  { level: 3, stored: 6,  label: "Hard",      cue: "Short sentences only — working now",       color: "#F59E0B" },
  { level: 4, stored: 8,  label: "Very hard", cue: "A few words at a time",                    color: "#F97316" },
  { level: 5, stored: 10, label: "Max",       cue: "Couldn't speak — nothing left",            color: "#EF4444" },
] as const;

/** The 1–10 value to store for a picked level. */
export function effortToStored(level: number): number {
  const found = EFFORT_LEVELS.find((e) => e.level === level);
  return found ? found.stored : 6;
}

/**
 * The level a stored value belongs to. Rounds up to the nearest band so a
 * session logged before this change — which could be any value 1–10 — still
 * shows a sensible selection rather than nothing.
 */
export function storedToEffort(rpe: number): number {
  if (!Number.isFinite(rpe)) return 3;
  const clamped = Math.max(1, Math.min(10, rpe));
  const match = EFFORT_LEVELS.find((e) => clamped <= e.stored);
  return match ? match.level : 5;
}

export function effortLevel(level: number): EffortLevel | undefined {
  return EFFORT_LEVELS.find((e) => e.level === level);
}
