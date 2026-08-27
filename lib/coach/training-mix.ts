/**
 * How this week's training was actually divided up.
 *
 * The analytics card headed "Weekly Training Mix" showed four progress bars,
 * and none of them measured what its label claimed. Two — "Erg Volume" and
 * "Weekly Goal" — were the identical expression, `weekly_distance_m / 20000`,
 * so they always rendered the same number under different names. "Erg Volume"
 * wasn't erg-specific at all; it counted every modality. The 20,000 was a
 * hardcoded target left behind when the dashboard's goal became derived, so
 * the two screens disagreed about the same athlete's goal. "Sessions / Goal"
 * divided by an invented 5, and "Streak Momentum" divided a streak by 7 to
 * produce a percentage of nothing.
 *
 * A training mix is a real and useful thing to show, and it's what the heading
 * promised: the share of the week spent on each kind of training, which is
 * what tells a paddler they've done four ergs and never got in a boat.
 */

export type Modality = "erg" | "water" | "team" | "dryland";

export interface MixSlice {
  modality: Modality;
  label: string;
  sessions: number;
  /** Share of the week's sessions, 0–100. */
  share: number;
  color: string;
}

const MODALITIES: Array<{ modality: Modality; label: string; color: string }> = [
  { modality: "erg", label: "Erg", color: "#0EA5E9" },
  { modality: "water", label: "Water", color: "#06B6D4" },
  { modality: "team", label: "Team", color: "#F97316" },
  { modality: "dryland", label: "Dryland", color: "#10B981" },
];

export interface WeekCounts {
  erg: number;
  water: number;
  team: number;
  dryland: number;
}

/**
 * Split the week's sessions by modality.
 *
 * Measured in sessions rather than distance, because distance can't compare
 * across modalities — a 6km paddle and a 45-minute lifting session are both
 * training, and only one of them has a distance at all. Counting sessions is
 * the honest common unit.
 *
 * Always returns all four, including the ones at zero: a gap is the most
 * useful thing on the chart, and hiding an empty bar hides it.
 */
export function trainingMix(counts: WeekCounts): MixSlice[] {
  const total = MODALITIES.reduce((n, m) => n + Math.max(0, counts[m.modality] || 0), 0);

  return MODALITIES.map(({ modality, label, color }) => {
    const sessions = Math.max(0, counts[modality] || 0);
    return {
      modality,
      label,
      sessions,
      share: total === 0 ? 0 : Math.round((sessions / total) * 100),
      color,
    };
  });
}

/** Total sessions across every modality. */
export function totalWeekSessions(counts: WeekCounts): number {
  return MODALITIES.reduce((n, m) => n + Math.max(0, counts[m.modality] || 0), 0);
}

/**
 * One line describing the balance, or null when there's nothing to say.
 *
 * Only speaks up once there's enough of a week to have a shape — a single
 * session isn't a lopsided week, it's a Monday.
 */
export function describeMix(counts: WeekCounts): string | null {
  const total = totalWeekSessions(counts);
  if (total < 3) return null;

  const mix = trainingMix(counts);
  const missing = mix.filter((m) => m.sessions === 0);
  const dominant = mix.reduce((a, b) => (b.sessions > a.sessions ? b : a));

  if (dominant.share >= 75 && missing.length > 0) {
    return `Almost all ${dominant.label.toLowerCase()} this week — ${missing
      .map((m) => m.label.toLowerCase())
      .join(", ")} untouched.`;
  }
  if (missing.length === 0) return "All four kinds of training covered this week.";
  return null;
}
