"use client";

import type { LocalErgSession, LocalWaterSession, LocalTeamSession, LocalDrylandSession } from "./schema";
import type { DashboardStats } from "@/lib/types";

export function computeDashboardStats(
  erg: LocalErgSession[],
  water: LocalWaterSession[],
  team: LocalTeamSession[],
  dryland: LocalDrylandSession[],
): DashboardStats {
  const allDates = [
    ...erg.map(s => ({ date: s.date, dist: s.distance_m })),
    ...water.map(s => ({ date: s.date, dist: s.distance_m })),
    ...team.map(s => ({ date: s.date, dist: s.distance_m ?? 0 })),
    ...dryland.map(s => ({ date: s.date, dist: 0 })),
  ];

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split("T")[0];

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

  const ergRated = erg.filter(s => (s.stroke_rate ?? 0) > 0).slice(0, 10);
  const avg_stroke_rate =
    ergRated.length > 0
      ? Math.round(ergRated.reduce((sum, s) => sum + (s.stroke_rate ?? 0), 0) / ergRated.length)
      : 0;

  // Streak: consecutive days ending today with ≥1 session
  const sessionDateSet = new Set(allDates.map(s => s.date));
  let current_streak = 0;
  const cur = new Date();
  for (;;) {
    const ds = cur.toISOString().split("T")[0];
    if (sessionDateSet.has(ds)) {
      current_streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    weekly_distance_m,
    weekly_time_min,
    weekly_sessions,
    avg_stroke_rate,
    current_streak,
    total_sessions: allDates.length,
  };
}

/** Last N weeks of total distance in metres, one bucket per 7-day window. */
export function computeWeeklyVolume(
  erg: LocalErgSession[],
  water: LocalWaterSession[],
  team: LocalTeamSession[],
  weeks = 8,
): { week: string; distance: number }[] {
  const now = new Date();
  const buckets: { week: string; distance: number }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);

    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    const label = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const dist =
      erg.filter(s => s.date >= startStr && s.date < endStr).reduce((n, s) => n + s.distance_m, 0) +
      water.filter(s => s.date >= startStr && s.date < endStr).reduce((n, s) => n + s.distance_m, 0) +
      team.filter(s => s.date >= startStr && s.date < endStr).reduce((n, s) => n + (s.distance_m ?? 0), 0);

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
      date: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      split: Math.round(s.split_sec),
    }));
}
