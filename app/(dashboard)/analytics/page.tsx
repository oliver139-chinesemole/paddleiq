"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Flame, Dumbbell, TrendingDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VolumeChart } from "@/components/charts/volume-chart";
import { ProgressChart } from "@/components/charts/progress-chart";
import { mockStats, mockErgSessions, weeklyVolumeData, ergProgressData } from "@/lib/data/seed";
import { formatTime, formatDistance, formatRelativeDate, formatPace } from "@/lib/utils";
import { useUser, IS_CONFIGURED } from "@/hooks/useUser";
import type { DashboardStats } from "@/lib/types";
import type { LocalErgSession } from "@/lib/db/schema";

const EMPTY_STATS: DashboardStats = {
  weekly_distance_m: 0, weekly_time_min: 0, weekly_sessions: 0,
  avg_stroke_rate: 0, current_streak: 0, total_sessions: 0,
};

export default function AnalyticsPage() {
  const { userId, isDemoMode } = useUser();
  const [stats, setStats] = useState<DashboardStats>(IS_CONFIGURED ? EMPTY_STATS : mockStats);
  const [ergSessions, setErgSessions] = useState<LocalErgSession[]>(IS_CONFIGURED ? [] : (mockErgSessions as unknown as LocalErgSession[]));
  const [volumeData, setVolumeData] = useState<{ week: string; distance: number }[]>(
    IS_CONFIGURED ? [] : weeklyVolumeData.map(d => ({ week: d.week, distance: d.distance }))
  );
  const [progressData, setProgressData] = useState<{ date: string; split: number }[]>(
    IS_CONFIGURED ? [] : ergProgressData.map(d => ({ date: d.date, split: d.split }))
  );

  useEffect(() => {
    if (isDemoMode) return;
    (async () => {
      const [{ getAllSessionsForUser }, { computeDashboardStats, computeWeeklyVolume, computeErgProgress }] =
        await Promise.all([
          import("@/lib/db/sessions"),
          import("@/lib/db/stats"),
        ]);

      const { erg, water, team, dryland } = await getAllSessionsForUser(userId);

      setStats(computeDashboardStats(erg, water, team, dryland));
      setVolumeData(computeWeeklyVolume(erg, water, team));
      setErgSessions(erg);

      const prog = computeErgProgress(erg);
      if (prog.length > 0) setProgressData(prog);
    })();
  }, [userId, isDemoMode]);

  // Improvement: compare first vs last split in progress data
  const firstSplit = progressData[0]?.split ?? 0;
  const lastSplit = progressData[progressData.length - 1]?.split ?? 0;
  const splitDelta = firstSplit - lastSplit; // positive = improvement
  const best2kSplit = lastSplit;

  const totalVolume = volumeData.reduce((s, d) => s + d.distance, 0);
  const avgWeeklyVolume = volumeData.length > 0 ? totalVolume / volumeData.length : 0;

  // Training load breakdown: % of weekly sessions by type (rough)
  const ergCount = ergSessions.filter(s => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    return s.date >= cutoff.toISOString().split("T")[0];
  }).length;

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#F1F5F9]">Analytics</h1>
        <p className="text-sm text-[#64748B] mt-1">Your training trends over time.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>Total Sessions</CardTitle>
          <CardValue className="mt-2">{stats.total_sessions || "—"}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">all time</p>
        </Card>
        <Card>
          <CardTitle>Current Streak</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Flame size={20} className="text-[#F97316]" />
            <CardValue>{stats.current_streak}</CardValue>
          </div>
          <p className="text-xs text-[#64748B] mt-1">days in a row</p>
        </Card>
        <Card>
          <CardTitle>Avg Stroke Rate</CardTitle>
          <CardValue className="mt-2">{stats.avg_stroke_rate || "—"}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">spm this month</p>
        </Card>
        <Card>
          <CardTitle>Best 2k Split</CardTitle>
          <CardValue className="mt-2 text-2xl">{best2kSplit > 0 ? formatPace(best2kSplit) : "—"}</CardValue>
          {splitDelta > 0 ? (
            <p className="text-xs text-[#10B981] mt-1">↓ {splitDelta}s from first session</p>
          ) : splitDelta < 0 ? (
            <p className="text-xs text-[#EF4444] mt-1">↑ {Math.abs(splitDelta)}s slower</p>
          ) : (
            <p className="text-xs text-[#64748B] mt-1">No change yet</p>
          )}
        </Card>
      </div>

      {/* Weekly Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Distance</CardTitle>
          <Badge variant="default">{volumeData.length} weeks</Badge>
        </CardHeader>
        <CardContent>
          <VolumeChart data={volumeData} />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "This Week", value: `${(stats.weekly_distance_m / 1000).toFixed(1)}km` },
              { label: "Avg / Week", value: `${(avgWeeklyVolume / 1000).toFixed(1)}km` },
              { label: "Total (chart)", value: `${(totalVolume / 1000).toFixed(0)}km` },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-base font-bold text-[#F1F5F9]">{s.value}</div>
                <div className="text-[10px] text-[#64748B]">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Erg Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Erg Split Progress</CardTitle>
          {splitDelta > 0 ? (
            <Badge variant="success">↓ Improving</Badge>
          ) : splitDelta < 0 ? (
            <Badge variant="warning">↑ Slower</Badge>
          ) : (
            <Badge variant="secondary">Steady</Badge>
          )}
        </CardHeader>
        <CardContent>
          <ProgressChart data={progressData} label="Split" />
          {splitDelta !== 0 && progressData.length >= 2 && (
            <div className={`mt-3 flex items-center gap-2 rounded-xl p-3 ${splitDelta > 0 ? "bg-[#10B981]/10" : "bg-[#EF4444]/10"}`}>
              {splitDelta > 0
                ? <TrendingDown size={16} className="text-[#10B981]" />
                : <TrendingUp size={16} className="text-[#EF4444]" />}
              <span className={`text-xs font-semibold ${splitDelta > 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {splitDelta > 0
                  ? `${splitDelta}s improvement over ${progressData.length} recorded sessions`
                  : `${Math.abs(splitDelta)}s slower over ${progressData.length} recorded sessions`}
              </span>
            </div>
          )}
          {progressData.length === 0 && (
            <p className="text-xs text-[#475569] text-center py-4">Log erg sessions to see your split trend.</p>
          )}
        </CardContent>
      </Card>

      {/* Erg Session Log */}
      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Erg Session Log</h2>
        {ergSessions.length === 0 ? (
          <p className="text-sm text-[#475569] text-center py-6">No erg sessions logged yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {ergSessions.slice(0, 10).map((session) => (
              <div key={session.localId ?? session.date} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={14} className="text-[#0EA5E9]" />
                    <span className="text-sm font-bold text-[#F1F5F9]">{formatDistance(session.distance_m)}</span>
                    {session.workout_type && (
                      <Badge variant="secondary" className="text-[10px]">{session.workout_type}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-[#64748B]">{formatRelativeDate(session.date)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Time",  value: formatTime(session.duration_sec) },
                    { label: "Split", value: session.split_sec > 0 ? formatPace(session.split_sec) : "—" },
                    { label: "SPM",   value: session.stroke_rate ? String(session.stroke_rate) : "—" },
                    { label: "RPE",   value: `${session.rpe}/10` },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#111827] rounded-xl p-2 text-center">
                      <div className="text-xs font-bold text-[#F1F5F9]">{s.value}</div>
                      <div className="text-[9px] text-[#475569] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                {session.notes && (
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed line-clamp-2">{session.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training Load */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Training Mix</CardTitle>
          <Badge variant={stats.weekly_sessions >= 4 ? "success" : stats.weekly_sessions >= 2 ? "warning" : "secondary"}>
            {stats.weekly_sessions} sessions
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Erg Volume",       value: Math.min((stats.weekly_distance_m / 20000) * 100, 100), color: "#0EA5E9" },
              { label: "Weekly Goal",      value: Math.min((stats.weekly_distance_m / 20000) * 100, 100), color: "#10B981" },
              { label: "Sessions / Goal",  value: Math.min((stats.weekly_sessions / 5) * 100, 100),       color: "#F59E0B" },
              { label: "Streak Momentum",  value: Math.min((stats.current_streak / 7) * 100, 100),        color: "#F97316" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#64748B]">{label}</span>
                  <span className="font-semibold text-[#94A3B8]">{Math.round(value)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#1E293B]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
