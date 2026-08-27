"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Flame, TrendingUp, Zap, Target, ChevronRight,
  Dumbbell, Droplets, Users, Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { weeklyGoal, goalProgress, goalBasisLabel } from "@/lib/coach/weekly-goal";
import { mockStats, mockErgSessions, mockPRs, weeklyVolumeData, trainingPlans } from "@/lib/data/seed";
import {
  useActivePlan, useActivePlanStart, dashboardPrompt, currentPlanWeek, trainingDayOfWeek,
} from "@/lib/plans/active";
import { formatTime, formatDistance, formatRelativeDate } from "@/lib/utils";
import { VolumeChart } from "@/components/charts/volume-chart";
import { Skeleton, SkeletonCard, SkeletonRow, LoadingAnnouncement } from "@/components/ui/skeleton";
import { useUser, IS_CONFIGURED } from "@/hooks/useUser";
import type { DashboardStats } from "@/lib/types";

const EMPTY_STATS: DashboardStats = {
  weekly_distance_m: 0, weekly_time_min: 0, weekly_sessions: 0,
  avg_stroke_rate: 0, current_streak: 0, total_sessions: 0,
};

type PRDisplay = {
  id: string | number;
  category: "erg" | "water";
  distance_m: number;
  time_sec: number;
  improvement_sec?: number;
  date: string;
};

type RecentItem = {
  id: string | number;
  type: "erg" | "water" | "team" | "dryland";
  date: string;
  distance_m: number;
  duration_sec?: number;
  duration_min?: number;
  workout_type?: string;
  practice_type?: string;
};

const DEMO_RECENT: RecentItem[] = mockErgSessions.slice(0, 3).map(s => ({
  id: s.id,
  type: "erg",
  date: s.date,
  distance_m: s.distance_m,
  duration_sec: s.duration_sec,
  workout_type: s.workout_type,
}));

const SESSION_CONFIG = {
  erg:     { Icon: Dumbbell, color: "#0EA5E9", label: "Erg Session" },
  water:   { Icon: Droplets, color: "#06B6D4", label: "Water Trial" },
  team:    { Icon: Users,    color: "#F97316", label: "Team Practice" },
  dryland: { Icon: Activity, color: "#10B981", label: "Dryland" },
} as const;

// The weekly target used to be a constant 20 here — the same number for a
// beginner in their first month and a racer peaking for a 500m, chosen by
// nobody. It's derived from the athlete's own recent weeks now; see
// lib/coach/weekly-goal.ts.

export default function DashboardPage() {
  const { userId, isDemoMode } = useUser();
  // Everyone waits now: demo mode reads IndexedDB too, and painting sample
  // numbers first would make them visibly swap for the athlete's own.
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(IS_CONFIGURED ? EMPTY_STATS : mockStats);
  const [recent, setRecent] = useState<RecentItem[]>(IS_CONFIGURED ? [] : DEMO_RECENT);
  const [prs, setPrs] = useState<PRDisplay[]>(IS_CONFIGURED ? [] : (mockPRs as unknown as PRDisplay[]));
  const [volumeData, setVolumeData] = useState<{ week: string; distance: number }[]>(
    IS_CONFIGURED ? [] : weeklyVolumeData.map(d => ({ week: d.week, distance: d.distance }))
  );
  const activePlanId = useActivePlan();

  const prompt = dashboardPrompt(stats.total_sessions, activePlanId);
  const activePlan = activePlanId ? trainingPlans.find((p) => p.id === activePlanId) ?? null : null;
  const activePlanName = activePlan?.name ?? null;

  // Which session the plan actually calls for today, rather than a generic
  // nudge. The card used to hardcode "4 x 500m Erg Intervals" for everyone.
  const planStart = useActivePlanStart();
  const planWeekNo = activePlan ? currentPlanWeek(planStart, activePlan.duration_weeks) : 1;
  const todaysWorkout = activePlan
    ? activePlan.weekly_schedule
        .find((w) => w.week === planWeekNo)
        ?.days.find((d) => d.day === trainingDayOfWeek()) ?? null
    : null;

  // Sample data is a placeholder, so it stops the moment there's something
  // real to put in its place. This used to bail out on isDemoMode before
  // reading IndexedDB at all — but sessions save locally whether or not
  // Supabase is configured, so an athlete on the deployed site logged a
  // session and then saw 147 sample sessions and someone else's 18.5km week,
  // with their own session on no screen anywhere.
  useEffect(() => {
    (async () => {
      try {
      const [{ getAllSessionsForUser }, { getLocalDB }, { computeDashboardStats, computeWeeklyVolume }, { shouldUseSampleData }] =
        await Promise.all([
          import("@/lib/db/sessions"),
          import("@/lib/db/schema"),
          import("@/lib/db/stats"),
          import("@/lib/data/source"),
        ]);

      const bundle = await getAllSessionsForUser(userId);
      if (shouldUseSampleData(bundle, isDemoMode)) return;
      const { erg, water, team, dryland } = bundle;

      setStats(computeDashboardStats(erg, water, team, dryland));
      setVolumeData(computeWeeklyVolume(erg, water, team));

      const items: RecentItem[] = [
        ...erg.map(s => ({ id: s.localId ?? 0, type: "erg" as const, date: s.date, distance_m: s.distance_m, duration_sec: s.duration_sec, workout_type: s.workout_type })),
        ...water.map(s => ({ id: s.localId ?? 0, type: "water" as const, date: s.date, distance_m: s.distance_m, duration_sec: s.duration_sec })),
        ...team.map(s => ({ id: s.localId ?? 0, type: "team" as const, date: s.date, distance_m: s.distance_m ?? 0, duration_min: s.duration_min, practice_type: s.practice_type })),
        ...dryland.map(s => ({ id: s.localId ?? 0, type: "dryland" as const, date: s.date, distance_m: 0, duration_min: s.duration_min })),
      ];
      items.sort((a, b) => b.date.localeCompare(a.date));
      setRecent(items.slice(0, 3));

      const db = getLocalDB();
      const localPRs = await db.personalRecords.where("userId").equals(userId).toArray();
      // Set unconditionally: past the sample-data check these are the
      // athlete's own sessions, so leaving sample PRs beside them would mix
      // two people's numbers on one screen.
      setPrs(localPRs.map(p => ({
        id: p.localId ?? 0,
        category: p.category,
        distance_m: p.distance_m,
        time_sec: p.time_sec,
        improvement_sec: p.improvement_sec,
        date: p.date,
      })));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, isDemoMode]);

  const weeklyDistanceKm = stats.weekly_distance_m / 1000;

  // volumeData runs oldest-first and its last bucket is the week in progress,
  // which is dropped: a target built partly from a two-day-old week would sink
  // every Monday and climb through the weekend.
  const goal = useMemo(
    () => weeklyGoal(volumeData.slice(0, -1).map((d) => d.distance / 1000)),
    [volumeData],
  );
  const weeklyProgress = goalProgress(weeklyDistanceKm, goal.target_km);

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <LoadingAnnouncement label="Loading your dashboard" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#8A98AC] text-sm">Good morning 👋</p>
          <h1 className="text-2xl font-black text-[#F1F5F9]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 bg-[#0D1528] border border-[#1E293B] rounded-xl px-3 py-2">
          <Flame size={16} className="text-[#F97316]" />
          <span className="text-sm font-bold text-[#F1F5F9]">{stats.current_streak}</span>
          <span className="text-xs text-[#8A98AC]">day streak</span>
        </div>
      </div>

      {/* Headline card — derived from what the app actually knows, rather than
          the hardcoded "4 × 500m Erg Intervals" prescription it used to show
          every athlete including ones who had never logged a session. */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#0D9488] p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[#BAE6FD] text-xs font-semibold uppercase tracking-wider">
              {prompt.kind === "first-session" ? "Get started"
                : prompt.kind === "active-plan"
                  ? `${activePlanName} · week ${planWeekNo}`
                  : "No plan running"}
            </p>
            <h2 className="text-white font-black text-lg mt-1">
              {prompt.kind === "first-session" ? "Log your first session"
                : prompt.kind === "active-plan" ? (todaysWorkout?.name ?? activePlanName ?? "Training plan")
                : "Pick a training plan"}
            </h2>
            <p className="text-[#BAE6FD] text-xs mt-1">
              {prompt.kind === "first-session"
                ? "Anything counts — an erg piece, a paddle, or a gym session."
                : prompt.kind === "active-plan"
                  ? todaysWorkout
                    ? `${todaysWorkout.description}${todaysWorkout.duration_min > 0 ? ` · ${todaysWorkout.duration_min} min` : ""}`
                    : "Keep logging and your coach insights sharpen as the weeks build."
                  : "Eight built-in plans, from first-timer to race prep."}
            </p>
          </div>
          <Zap size={20} className="text-white/70" />
        </div>
        <div className="flex gap-2 mt-4">
          <Link
            href={prompt.kind === "pick-plan" ? "/plans" : "/train"}
            className="flex-1 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm text-center py-2.5 rounded-xl transition-colors"
          >
            {prompt.kind === "pick-plan" ? "Browse plans" : "Log a session"}
          </Link>
          <Link
            href="/plans"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            {prompt.kind === "active-plan" ? "View plan" : "Plans"}
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Log a Workout</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/train/erg",     Icon: Dumbbell, label: "Erg Session",   color: "#0EA5E9" },
            { href: "/train/water",   Icon: Droplets, label: "Water Trial",   color: "#06B6D4" },
            { href: "/train/team",    Icon: Users,    label: "Team Practice", color: "#F97316" },
            { href: "/train/dryland", Icon: Activity, label: "Dryland",       color: "#10B981" },
          ].map(({ href, Icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4 hover:border-[#334155] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <span className="text-sm font-semibold text-[#F1F5F9]">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-1">
          <CardTitle>Distance</CardTitle>
          <CardValue className="text-2xl mt-2">{weeklyDistanceKm.toFixed(1)}</CardValue>
          <p className="text-xs text-[#8A98AC] mt-1">km this week</p>
        </Card>
        <Card className="col-span-1">
          <CardTitle>Sessions</CardTitle>
          <CardValue className="text-2xl mt-2">{stats.weekly_sessions}</CardValue>
          <p className="text-xs text-[#8A98AC] mt-1">this week</p>
        </Card>
        <Card className="col-span-1">
          <CardTitle>Avg SPM</CardTitle>
          <CardValue className="text-2xl mt-2">{stats.avg_stroke_rate || "—"}</CardValue>
          <p className="text-xs text-[#8A98AC] mt-1">strokes/min</p>
        </Card>
      </div>

      {/* Weekly Goal */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Distance Goal</CardTitle>
          <span className="text-xs text-[#8A98AC]">
            {weeklyDistanceKm.toFixed(1)} / {goal.target_km} km
          </span>
        </CardHeader>
        <CardContent>
          <Progress value={weeklyProgress} color={weeklyProgress >= 100 ? "#10B981" : "#0EA5E9"} className="mb-3" />
          {/* Where the number came from. A target you can't account for is
              just a number to feel bad about. */}
          <p className="text-[10px] text-[#7C8AA0] -mt-1 mb-3">{goalBasisLabel(goal)}</p>
          <VolumeChart data={volumeData} />
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#8A98AC] uppercase tracking-wider">Recent Sessions</h2>
          <Link href="/analytics" className="text-xs text-[#0EA5E9] flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {recent.length === 0 ? (
            <p className="text-sm text-[#7C8AA0] text-center py-6">No sessions logged yet. Start training!</p>
          ) : (
            recent.map((s) => {
              const cfg = SESSION_CONFIG[s.type];
              const durationSec = s.duration_sec ?? (s.duration_min ?? 0) * 60;
              return (
                <div key={`${s.type}-${s.id}`} className="flex items-center gap-4 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cfg.color}20` }}>
                    <cfg.Icon size={18} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#F1F5F9]">{cfg.label}</span>
                      {(s.workout_type || s.practice_type) && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          {s.workout_type ?? s.practice_type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[#8A98AC] mt-0.5">{formatRelativeDate(s.date)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {s.distance_m > 0 && (
                      <div className="text-sm font-bold text-[#F1F5F9]">{formatDistance(s.distance_m)}</div>
                    )}
                    {durationSec > 0 && (
                      <div className="text-xs text-[#8A98AC]">{formatTime(durationSec)}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PRs Snapshot */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#8A98AC] uppercase tracking-wider">Personal Records</h2>
          <Link href="/records" className="text-xs text-[#0EA5E9] flex items-center gap-1">
            All PRs <ChevronRight size={12} />
          </Link>
        </div>
        {prs.length === 0 ? (
          <p className="text-sm text-[#7C8AA0] text-center py-4">No PRs yet — log a session to set one!</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {prs.slice(0, 4).map((pr) => (
              <div key={String(pr.id)} className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Target size={12} className="text-[#F59E0B]" />
                  <span className="text-[10px] font-semibold text-[#8A98AC] uppercase">
                    {pr.category} {pr.distance_m >= 1000 ? `${pr.distance_m / 1000}k` : `${pr.distance_m}m`}
                  </span>
                </div>
                <div className="text-xl font-black text-[#F1F5F9]">{formatTime(pr.time_sec)}</div>
                {pr.improvement_sec && pr.improvement_sec > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp size={11} className="text-[#10B981]" />
                    <span className="text-[10px] text-[#10B981] font-semibold">−{pr.improvement_sec}s</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Coach Teaser */}
      <Link href="/ai-coach">
        <div className="rounded-2xl border border-[#334155] bg-gradient-to-r from-[#0D1528] to-[#111827] p-5 hover:border-[#7C8AA0] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#A855F7]/20 flex items-center justify-center">
              <Zap size={18} className="text-[#A855F7]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#F1F5F9]">AI Coach</div>
              <div className="text-xs text-[#8A98AC]">Personalized training insights</div>
            </div>
            <ChevronRight size={16} className="text-[#7C8AA0] ml-auto" />
          </div>
          <p className="text-xs text-[#8A98AC] leading-relaxed">
            See your weekly summary, training load, PR proximity, and more — all computed from your own data.
          </p>
          <div className="mt-2">
            <Badge variant="secondary" className="text-[10px]">Rules-based · No AI needed</Badge>
          </div>
        </div>
      </Link>

      {/* Technique Focus */}
      <Link href="/technique">
        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5 hover:border-[#334155] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider">This Week&apos;s Technique Focus</p>
            <ChevronRight size={14} className="text-[#7C8AA0]" />
          </div>
          <h3 className="text-base font-bold text-[#F1F5F9] mb-1">The Catch</h3>
          <p className="text-xs text-[#8A98AC]">
            A clean, deep, early catch is the single most important part of an efficient dragon boat stroke.
          </p>
        </div>
      </Link>
    </div>
  );
}
