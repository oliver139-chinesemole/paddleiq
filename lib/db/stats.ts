"use client";

import type { LocalErgSession, LocalWaterSession, LocalTeamSession, LocalDrylandSession } from "./schema";
import type { DashboardStats } from "@/lib/types";

// Session dates are stored as plain local "YYYY-MM-DD" strings, so every
// comparison here has to be done in local time too. Using toISOString() to
// derive "today" reads the date in UTC, which is a different day from early
// evening onward anywhere west of Greenwich — for a paddler in California that
// is every session logged after 4pm.

/** Local calendar date as "YYYY-MM-DD". */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** A new Date `days` before `from`, leaving the original untouched. */
function daysBefore(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Consecutive days of training, counting back from today.
 *
 * A streak stays alive until a full day is missed, so it anchors on today or
 * yesterday. Anchoring on today alone — as this used to — reported a streak of
 * zero every morning until the athlete trained again, which is both wrong and
 * the most discouraging possible moment to show it.
 */
export function computeStreak(sessionDates: Set<string>, now = new Date()): number {
  const today = toLocalDateStr(now);
  const yesterday = toLocalDateStr(daysBefore(now, 1));

  let cursor: Date;
  if (sessionDates.has(today)) cursor = new Date(now);
  else if (sessionDates.has(yesterday)) cursor = daysBefore(now, 1);
  else return 0;

  let streak = 0;
  // Bounded so a corrupt date set can't spin forever.
  for (let guard = 0; guard < 3650; guard++) {
    if (!sessionDates.has(toLocalDateStr(cursor))) break;
    streak++;
    cursor = daysBefore(cursor, 1);
  }
  return streak;
}

export function computeDashboardStats(
  erg: LocalErgSession[],
  water: LocalWaterSession[],
  team: LocalTeamSession[],
  dryland: LocalDrylandSession[],
  now = new Date(),
): DashboardStats {
  const allDates = [
    ...erg.map(s => ({ date: s.date, dist: s.distance_m })),
    ...water.map(s => ({ date: s.date, dist: s.distance_m })),
    ...team.map(s => ({ date: s.date, dist: s.distance_m ?? 0 })),
    ...dryland.map(s => ({ date: s.date, dist: 0 })),
  ];

  // "This week" is the last 7 days including today, so the window opens 6 days
  // back — counting back a full 7 would make it an 8-day week.
  const cutoffStr = toLocalDateStr(daysBefore(now, 6));

  const weekly = allDates.filter(s => s.date >= cutoffStr);
  const weekly_distance_m = weekly.reduce((sum, s) => sum + s.dist, 0);
  const weekly_sessions = weekly.length;

  const ergW = erg.filter(s => s.date >= cutoffStr);
  const waterW = water.filter(s => s.date >= cutoffStr);
  const teamW = team.filter(s => s.date >= cutoffStr);
  const dryW = dryland.filter(s => s.date >= cutoffStr);

  const weekly_time_min = Math.round(
    (ergW.reduce((sum, s) => sum + s.duration_sec, 0) +
      waterW.reduce((sum, s) => sum + s.duration_sec, 0) +
      teamW.reduce((sum, s) => sum + (s.duration_min ?? 0) * 60, 0) +
      dryW.reduce((sum, s) => sum + (s.duration_min ?? 0) * 60, 0)) / 60,
  );

  // Sort before slicing rather than trusting the caller's ordering — this is
  // meant to be the ten most recent rated sessions, not ten arbitrary ones.
  const ergRated = erg
    .filter(s => (s.stroke_rate ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const avg_stroke_rate =
    ergRated.length > 0
      ? Math.round(ergRated.reduce((sum, s) => sum + (s.stroke_rate ?? 0), 0) / ergRated.length)
      : 0;

  return {
    weekly_distance_m,
    weekly_time_min,
    weekly_sessions,
    avg_stroke_rate,
    current_streak: computeStreak(new Set(allDates.map(s => s.date)), now),
    total_sessions: allDates.length,
  };
}

/** Last N weeks of total distance in metres, one bucket per 7-day window. */
export function computeWeeklyVolume(
  erg: LocalErgSession[],
  water: LocalWaterSession[],
  team: LocalTeamSession[],
  weeks = 8,
  now = new Date(),
): { week: string; distance: number }[] {
  const buckets: { week: string; distance: number }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    // Each bucket covers 7 days ending on `end`, inclusive at both ends. The
    // previous version excluded its end date, so the newest bucket silently
    // dropped today's session — the one an athlete just logged and is looking
    // for on the chart.
    const end = daysBefore(now, i * 7);
    const start = daysBefore(end, 6);

    const startStr = toLocalDateStr(start);
    const endStr = toLocalDateStr(end);
    const label = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const inWindow = (date: string) => date >= startStr && date <= endStr;

    const dist =
      erg.filter(s => inWindow(s.date)).reduce((n, s) => n + s.distance_m, 0) +
      water.filter(s => inWindow(s.date)).reduce((n, s) => n + s.distance_m, 0) +
      team.filter(s => inWindow(s.date)).reduce((n, s) => n + (s.distance_m ?? 0), 0);

    buckets.push({ week: label, distance: dist });
  }

  return buckets;
}

/** Erg split trend for the progress chart (up to last 20 sessions, sorted oldest→newest). */
export function computeErgProgress(erg: LocalErgSession[]): { date: string; split: number }[] {
  return [...erg]
    .filter(s => (s.split_sec ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20)
    .map(s => ({
      // Parsed as local midnight; "2026-06-04" alone would be read as UTC and
      // render as the previous day for anyone behind Greenwich.
      date: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      split: Math.round(s.split_sec),
    }));
}
