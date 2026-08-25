/**
 * Unit tests for the dashboard stat calculations.
 *
 * These drive the numbers on the home screen — streak, weekly distance,
 * sessions — so they are the most-looked-at figures in the app. Every function
 * takes an injectable clock; without one these were untestable, which is how
 * the streak and timezone bugs survived.
 */
import { describe, it, expect } from "vitest";
import {
  toLocalDateStr,
  computeStreak,
  computeDashboardStats,
  computeWeeklyVolume,
  computeErgProgress,
} from "../stats";
import type {
  LocalErgSession, LocalWaterSession, LocalTeamSession, LocalDrylandSession,
} from "../schema";

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Local noon, so a test can't trip over a daylight-saving boundary. */
const at = (iso: string) => new Date(`${iso}T12:00:00`);
const NOW = at("2026-06-15");

const dayBefore = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
};

const erg = (date: string, o: Partial<LocalErgSession> = {}): LocalErgSession => ({
  userId: "u1", synced: 1, date,
  distance_m: 2000, duration_sec: 480, split_sec: 120, stroke_rate: 70,
  rpe: 7, paddle_side: "left", workout_type: "steady", created_at: date,
  user_id: "u1",
  ...o,
} as LocalErgSession);

const water = (date: string, o: Partial<LocalWaterSession> = {}): LocalWaterSession => ({
  userId: "u1", synced: 1, date,
  distance_m: 5000, duration_sec: 1800, avg_pace_sec: 180,
  avg_speed_kmh: 10, max_speed_kmh: 12, rpe: 6, boat_type: "oc1",
  created_at: date, user_id: "u1",
  ...o,
} as LocalWaterSession);

const team = (date: string, o: Partial<LocalTeamSession> = {}): LocalTeamSession => ({
  userId: "u1", synced: 1, date,
  duration_min: 90, distance_m: 8000, practice_type: "endurance",
  paddle_side: "left", role_in_boat: "paddler", created_at: date,
  team_id: "t1", user_id: "u1",
  ...o,
} as LocalTeamSession);

const dryland = (date: string, o: Partial<LocalDrylandSession> = {}): LocalDrylandSession => ({
  userId: "u1", synced: 1, date,
  duration_min: 45, exercises: [], rpe: 6, created_at: date, user_id: "u1",
  ...o,
} as LocalDrylandSession);

// ── Date handling ────────────────────────────────────────────────────────────

describe("toLocalDateStr", () => {
  it("formats the local calendar date", () => {
    expect(toLocalDateStr(at("2026-06-15"))).toBe("2026-06-15");
    expect(toLocalDateStr(at("2026-01-05"))).toBe("2026-01-05");
  });

  it("uses local time, not UTC", () => {
    // 8pm local on the 15th. In any timezone behind UTC, toISOString() would
    // report the 16th — the bug that made evening sessions vanish.
    const evening = new Date("2026-06-15T20:00:00");
    expect(toLocalDateStr(evening)).toBe("2026-06-15");
  });
});

// ── Streak ───────────────────────────────────────────────────────────────────

describe("computeStreak", () => {
  const setOf = (...offsets: number[]) =>
    new Set(offsets.map((n) => dayBefore(NOW, n)));

  it("counts consecutive days ending today", () => {
    expect(computeStreak(setOf(0, 1, 2), NOW)).toBe(3);
  });

  it("keeps the streak alive when today's session hasn't happened yet", () => {
    // Regression: anchoring on today alone reported 0 every morning until the
    // athlete trained, wiping a long streak from the dashboard.
    expect(computeStreak(setOf(1, 2, 3), NOW)).toBe(3);
  });

  it("breaks once a full day is missed", () => {
    // Last trained two days ago — today and yesterday are both empty.
    expect(computeStreak(setOf(2, 3, 4), NOW)).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(computeStreak(setOf(0, 1, 3, 4), NOW)).toBe(2);
  });

  it("counts a single session today as a streak of one", () => {
    expect(computeStreak(setOf(0), NOW)).toBe(1);
  });

  it("counts a single session yesterday as a streak of one", () => {
    expect(computeStreak(setOf(1), NOW)).toBe(1);
  });

  it("returns zero for no sessions", () => {
    expect(computeStreak(new Set(), NOW)).toBe(0);
  });

  it("ignores future-dated sessions", () => {
    const future = new Set([dayBefore(NOW, -3)]);
    expect(computeStreak(future, NOW)).toBe(0);
  });

  it("handles a streak spanning a month boundary", () => {
    const now = at("2026-07-02");
    const dates = new Set([
      "2026-07-02", "2026-07-01", "2026-06-30", "2026-06-29",
    ]);
    expect(computeStreak(dates, now)).toBe(4);
  });

  it("terminates rather than looping on a dense date set", () => {
    // Every day for 20 years; the guard must stop it.
    const dates = new Set<string>();
    for (let i = 0; i < 7300; i++) dates.add(dayBefore(NOW, i));
    const streak = computeStreak(dates, NOW);
    expect(streak).toBeGreaterThan(3000);
    expect(streak).toBeLessThanOrEqual(3650);
  });
});

// ── Dashboard stats ──────────────────────────────────────────────────────────

describe("computeDashboardStats", () => {
  it("sums distance across every session type in the last 7 days", () => {
    const s = computeDashboardStats(
      [erg(dayBefore(NOW, 1))],
      [water(dayBefore(NOW, 2))],
      [team(dayBefore(NOW, 3))],
      [dryland(dayBefore(NOW, 4))],
      NOW,
    );
    expect(s.weekly_distance_m).toBe(2000 + 5000 + 8000);
    expect(s.weekly_sessions).toBe(4);
    expect(s.total_sessions).toBe(4);
  });

  it("treats the week as 7 days including today, not 8", () => {
    // 6 days back is inside the window; 7 days back is not.
    const inside = computeDashboardStats([erg(dayBefore(NOW, 6))], [], [], [], NOW);
    const outside = computeDashboardStats([erg(dayBefore(NOW, 7))], [], [], [], NOW);
    expect(inside.weekly_sessions).toBe(1);
    expect(outside.weekly_sessions).toBe(0);
  });

  it("still counts old sessions toward the total", () => {
    const s = computeDashboardStats([erg(dayBefore(NOW, 90))], [], [], [], NOW);
    expect(s.weekly_sessions).toBe(0);
    expect(s.total_sessions).toBe(1);
  });

  it("converts every duration to minutes", () => {
    const s = computeDashboardStats(
      [erg(dayBefore(NOW, 1), { duration_sec: 600 })],   // 10 min
      [],
      [team(dayBefore(NOW, 1), { duration_min: 20 })],   // 20 min
      [dryland(dayBefore(NOW, 1), { duration_min: 30 })], // 30 min
      NOW,
    );
    expect(s.weekly_time_min).toBe(60);
  });

  it("averages stroke rate over the ten most recent rated sessions", () => {
    // Oldest first, so an implementation that slices without sorting picks
    // exactly the wrong ten.
    const sessions = Array.from({ length: 15 }, (_, i) =>
      erg(dayBefore(NOW, 20 - i), { stroke_rate: i < 5 ? 40 : 80 }),
    );
    const s = computeDashboardStats(sessions, [], [], [], NOW);
    expect(s.avg_stroke_rate).toBe(80);
  });

  it("ignores sessions with no stroke rate recorded", () => {
    const s = computeDashboardStats(
      [erg(dayBefore(NOW, 1), { stroke_rate: 0 }), erg(dayBefore(NOW, 2), { stroke_rate: 60 })],
      [], [], [], NOW,
    );
    expect(s.avg_stroke_rate).toBe(60);
  });

  it("returns zeroes for an athlete with no sessions", () => {
    const s = computeDashboardStats([], [], [], [], NOW);
    expect(s).toEqual({
      weekly_distance_m: 0,
      weekly_time_min: 0,
      weekly_sessions: 0,
      avg_stroke_rate: 0,
      current_streak: 0,
      total_sessions: 0,
    });
  });

  it("reports a live streak even before today's session", () => {
    const s = computeDashboardStats(
      [erg(dayBefore(NOW, 1)), erg(dayBefore(NOW, 2))],
      [], [], [], NOW,
    );
    expect(s.current_streak).toBe(2);
  });

  it("counts team sessions with no distance without producing NaN", () => {
    const s = computeDashboardStats(
      [], [], [team(dayBefore(NOW, 1), { distance_m: undefined })], [], NOW,
    );
    expect(s.weekly_distance_m).toBe(0);
    expect(Number.isFinite(s.weekly_distance_m)).toBe(true);
  });
});

// ── Weekly volume ────────────────────────────────────────────────────────────

describe("computeWeeklyVolume", () => {
  it("returns one bucket per requested week", () => {
    expect(computeWeeklyVolume([], [], [], 8, NOW)).toHaveLength(8);
    expect(computeWeeklyVolume([], [], [], 4, NOW)).toHaveLength(4);
  });

  it("includes today in the most recent bucket", () => {
    // Regression: the window excluded its end date, so a session logged today
    // never showed up on the chart.
    const buckets = computeWeeklyVolume([erg(dayBefore(NOW, 0))], [], [], 4, NOW);
    expect(buckets.at(-1)!.distance).toBe(2000);
  });

  it("puts a session from last week in the previous bucket", () => {
    const buckets = computeWeeklyVolume([erg(dayBefore(NOW, 7))], [], [], 4, NOW);
    expect(buckets.at(-1)!.distance).toBe(0);
    expect(buckets.at(-2)!.distance).toBe(2000);
  });

  it("counts each session exactly once across all buckets", () => {
    const sessions = Array.from({ length: 20 }, (_, i) => erg(dayBefore(NOW, i)));
    const buckets = computeWeeklyVolume(sessions, [], [], 8, NOW);
    const total = buckets.reduce((n, b) => n + b.distance, 0);
    expect(total).toBe(20 * 2000);
  });

  it("sums across erg, water and team", () => {
    const buckets = computeWeeklyVolume(
      [erg(dayBefore(NOW, 1))],
      [water(dayBefore(NOW, 1))],
      [team(dayBefore(NOW, 1))],
      4, NOW,
    );
    expect(buckets.at(-1)!.distance).toBe(2000 + 5000 + 8000);
  });

  it("leaves buckets empty when nothing was logged", () => {
    const buckets = computeWeeklyVolume([], [], [], 4, NOW);
    expect(buckets.every((b) => b.distance === 0)).toBe(true);
    expect(buckets.every((b) => typeof b.week === "string" && b.week.length > 0)).toBe(true);
  });
});

// ── Erg progress ─────────────────────────────────────────────────────────────

describe("computeErgProgress", () => {
  it("sorts oldest to newest", () => {
    const out = computeErgProgress([
      erg("2026-06-10", { split_sec: 120 }),
      erg("2026-06-01", { split_sec: 130 }),
    ]);
    expect(out.map((p) => p.split)).toEqual([130, 120]);
  });

  it("keeps only the most recent 20", () => {
    const sessions = Array.from({ length: 30 }, (_, i) =>
      erg(dayBefore(NOW, 29 - i), { split_sec: 100 + i }),
    );
    const out = computeErgProgress(sessions);
    expect(out).toHaveLength(20);
    expect(out.at(-1)!.split).toBe(129);
  });

  it("drops sessions with no split recorded", () => {
    expect(computeErgProgress([erg("2026-06-01", { split_sec: 0 })])).toHaveLength(0);
  });

  it("labels the date without slipping a day in negative offsets", () => {
    const [point] = computeErgProgress([erg("2026-06-15", { split_sec: 120 })]);
    expect(point.date).toBe("Jun 15");
  });

  it("handles an empty list", () => {
    expect(computeErgProgress([])).toEqual([]);
  });
});
