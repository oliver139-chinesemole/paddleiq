import Link from "next/link";
import {
  Flame, TrendingUp, Timer, Zap, Target, Plus, ChevronRight,
  Dumbbell, Droplets, Users, Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardValue, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { mockStats, mockErgSessions, mockPRs, weeklyVolumeData } from "@/lib/data/seed";
import { formatTime, formatDistance, formatRelativeDate } from "@/lib/utils";
import { VolumeChart } from "@/components/charts/volume-chart";

export default function DashboardPage() {
  const lastErgSession = mockErgSessions[0];
  const weeklyGoalKm = 20;
  const weeklyDistanceKm = mockStats.weekly_distance_m / 1000;
  const weeklyProgress = (weeklyDistanceKm / weeklyGoalKm) * 100;

  return (
    <div className="py-6 flex flex-col gap-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#64748B] text-sm">Good morning 👋</p>
          <h1 className="text-2xl font-black text-[#F1F5F9]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 bg-[#0D1528] border border-[#1E293B] rounded-xl px-3 py-2">
          <Flame size={16} className="text-[#F97316]" />
          <span className="text-sm font-bold text-[#F1F5F9]">{mockStats.current_streak}</span>
          <span className="text-xs text-[#64748B]">day streak</span>
        </div>
      </div>

      {/* Today's Workout Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#0D9488] p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[#BAE6FD] text-xs font-semibold uppercase tracking-wider">Today&apos;s Workout</p>
            <h2 className="text-white font-black text-lg mt-1">4 × 500m Erg Intervals</h2>
            <p className="text-[#BAE6FD] text-xs mt-1">Target split: 128–132s/500m · RPE 8</p>
          </div>
          <Zap size={20} className="text-white/70" />
        </div>
        <div className="flex gap-2 mt-4">
          <Link
            href="/train/erg"
            className="flex-1 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm text-center py-2.5 rounded-xl transition-colors"
          >
            Start Erg Session
          </Link>
          <Link
            href="/plans"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            View Plan
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-3">Log a Workout</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/train/erg", icon: Dumbbell, label: "Erg Session", color: "#0EA5E9", bg: "#0EA5E9" },
            { href: "/train/water", icon: Droplets, label: "Water Trial", color: "#06B6D4", bg: "#06B6D4" },
            { href: "/train/team", icon: Users, label: "Team Practice", color: "#F97316", bg: "#F97316" },
            { href: "/train/dryland", icon: Activity, label: "Dryland", color: "#10B981", bg: "#10B981" },
          ].map(({ href, icon: Icon, label, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4 hover:border-[#334155] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${bg}20` }}>
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
          <CardValue className="text-2xl mt-2">{(mockStats.weekly_distance_m / 1000).toFixed(1)}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">km this week</p>
        </Card>
        <Card className="col-span-1">
          <CardTitle>Sessions</CardTitle>
          <CardValue className="text-2xl mt-2">{mockStats.weekly_sessions}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">this week</p>
        </Card>
        <Card className="col-span-1">
          <CardTitle>Avg SPM</CardTitle>
          <CardValue className="text-2xl mt-2">{mockStats.avg_stroke_rate}</CardValue>
          <p className="text-xs text-[#64748B] mt-1">strokes/min</p>
        </Card>
      </div>

      {/* Weekly Goal */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Distance Goal</CardTitle>
          <span className="text-xs text-[#64748B]">
            {weeklyDistanceKm.toFixed(1)} / {weeklyGoalKm} km
          </span>
        </CardHeader>
        <CardContent>
          <Progress value={weeklyProgress} color={weeklyProgress >= 100 ? "#10B981" : "#0EA5E9"} className="mb-3" />
          <VolumeChart data={weeklyVolumeData} />
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider">Recent Sessions</h2>
          <Link href="/analytics" className="text-xs text-[#0EA5E9] flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {mockErgSessions.slice(0, 3).map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-4 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0EA5E9]/15 flex items-center justify-center shrink-0">
                <Dumbbell size={18} className="text-[#0EA5E9]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#F1F5F9]">Erg Session</span>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                    {session.workout_type}
                  </Badge>
                </div>
                <div className="text-xs text-[#64748B] mt-0.5">{formatRelativeDate(session.date)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-[#F1F5F9]">{formatDistance(session.distance_m)}</div>
                <div className="text-xs text-[#64748B]">{formatTime(session.duration_sec)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PRs Snapshot */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider">Personal Records</h2>
          <Link href="/records" className="text-xs text-[#0EA5E9] flex items-center gap-1">
            All PRs <ChevronRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {mockPRs.slice(0, 4).map((pr) => (
            <div key={pr.id} className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={12} className="text-[#F59E0B]" />
                <span className="text-[10px] font-semibold text-[#64748B] uppercase">
                  {pr.category.toUpperCase()} {pr.distance_m}m
                </span>
              </div>
              <div className="text-xl font-black text-[#F1F5F9]">{formatTime(pr.time_sec)}</div>
              {pr.improvement_sec && (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp size={11} className="text-[#10B981]" />
                  <span className="text-[10px] text-[#10B981] font-semibold">−{pr.improvement_sec}s</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Coach Teaser */}
      <Link href="/ai-coach">
        <div className="rounded-2xl border border-[#334155] bg-gradient-to-r from-[#0D1528] to-[#111827] p-5 hover:border-[#475569] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#A855F7]/20 flex items-center justify-center">
              <Zap size={18} className="text-[#A855F7]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#F1F5F9]">AI Coach</div>
              <div className="text-xs text-[#64748B]">Personalized training insights</div>
            </div>
            <ChevronRight size={16} className="text-[#475569] ml-auto" />
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">
            &quot;Your 2k erg time improved by 12 seconds over the last 5 sessions. Focus on sustaining your second 500m split — it fades by about 3s. Try pacing intervals next.&quot;
          </p>
          <div className="mt-2">
            <Badge variant="secondary" className="text-[10px]">AI-Generated</Badge>
          </div>
        </div>
      </Link>

      {/* Technique Focus */}
      <Link href="/technique">
        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5 hover:border-[#334155] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">This Week&apos;s Technique Focus</p>
            <ChevronRight size={14} className="text-[#475569]" />
          </div>
          <h3 className="text-base font-bold text-[#F1F5F9] mb-1">The Catch</h3>
          <p className="text-xs text-[#64748B]">
            A clean, deep, early catch is the single most important part of an efficient dragon boat stroke.
          </p>
        </div>
      </Link>
    </div>
  );
}
