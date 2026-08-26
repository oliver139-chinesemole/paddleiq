/**
 * Deciding whether to show an athlete their own data or the sample data.
 *
 * The deployed site runs without Supabase configured, which the app calls demo
 * mode. Every page took that to mean "this person has no data" and returned
 * early before reading IndexedDB — but sessions save locally regardless of
 * whether Supabase is configured. So an athlete could log a session, get
 * redirected to the dashboard, and see 147 sample sessions and 18.5km of
 * someone else's training week, with their own session nowhere on any screen.
 *
 * The rule is one sentence: sample data is a placeholder, and a placeholder
 * stops being shown the moment there is something real to put in its place.
 * Demo mode changes what happens when the athlete has *nothing*, not what
 * happens when they have something.
 */

export interface SessionCounts {
  erg: unknown[];
  water: unknown[];
  team: unknown[];
  dryland: unknown[];
}

/** How many sessions of any kind the athlete has logged. */
export function totalSessions(bundle: SessionCounts): number {
  return bundle.erg.length + bundle.water.length + bundle.team.length + bundle.dryland.length;
}

/**
 * Whether to fall back to the sample data.
 *
 * True only when there is genuinely nothing of the athlete's own *and* the app
 * is in demo mode. A configured account with no sessions gets a real empty
 * state instead, because for them "no sessions" is the truth and filling it
 * with someone else's training would be a lie they can act on.
 */
export function shouldUseSampleData(bundle: SessionCounts, isDemoMode: boolean): boolean {
  return isDemoMode && totalSessions(bundle) === 0;
}
