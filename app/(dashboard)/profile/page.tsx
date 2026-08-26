"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Settings, Award, Bell, LogOut, ChevronRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockStats, mockPRs } from "@/lib/data/seed";
import { formatTime } from "@/lib/utils";
import { Skeleton, SkeletonCard, LoadingAnnouncement } from "@/components/ui/skeleton";
import { useUser, IS_CONFIGURED } from "@/hooks/useUser";
import type { DashboardStats } from "@/lib/types";
import type { LocalPR } from "@/lib/db/schema";

const EMPTY_STATS: DashboardStats = {
  weekly_distance_m: 0, weekly_time_min: 0, weekly_sessions: 0,
  avg_stroke_rate: 0, current_streak: 0, total_sessions: 0,
};

const STATIC_BADGES = [
  { id: "b1", name: "First 500m Test",  icon: "🎯", key: "has500" },
  { id: "b2", name: "10 Sessions",       icon: "🔟", key: "ten_sessions" },
  { id: "b3", name: "PR Breaker",        icon: "🚀", key: "pr_improved" },
  { id: "b4", name: "Erg Warrior",       icon: "💪", key: "erg_warrior" },
  { id: "b5", name: "Race Ready",        icon: "🏆", key: "has_2k" },
  { id: "b6", name: "Consistency King",  icon: "🔥", key: "streak_7" },
  { id: "b7", name: "Technique Student", icon: "📚", key: "always" },
  { id: "b8", name: "Team Player",       icon: "🐉", key: "team_session" },
] as const;

type BadgeKey = typeof STATIC_BADGES[number]["key"];

type PRDisplay = {
  label: string;
  time_sec: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, userId, isDemoMode } = useUser();
  // Only real accounts wait on anything — demo data is there synchronously.
  const [loading, setLoading] = useState(IS_CONFIGURED);

  const [stats, setStats] = useState<DashboardStats>(IS_CONFIGURED ? EMPTY_STATS : mockStats);
  const [topPRs, setTopPRs] = useState<PRDisplay[]>(IS_CONFIGURED ? [] : [
    { label: "2k Erg",     time_sec: 512 },
    { label: "500m Erg",   time_sec: 118 },
    { label: "500m Water", time_sec: 145 },
    { label: "1k Erg",     time_sec: 248 },
  ]);
  const [prCount, setPrCount] = useState(IS_CONFIGURED ? 0 : mockPRs.length);
  const [earnedBadges, setEarnedBadges] = useState<Set<BadgeKey>>(
    IS_CONFIGURED
      ? new Set(["always"] as BadgeKey[])
      : new Set(["always", "has500", "ten_sessions", "pr_improved", "erg_warrior"] as BadgeKey[])
  );

  useEffect(() => {
    if (isDemoMode) return;
    (async () => {
      try {
      const [{ getAllSessionsForUser }, { getLocalDB }, { computeDashboardStats }] = await Promise.all([
        import("@/lib/db/sessions"),
        import("@/lib/db/schema"),
        import("@/lib/db/stats"),
      ]);

      const [{ erg, water, team, dryland }, db] = await Promise.all([
        getAllSessionsForUser(userId),
        getLocalDB(),
      ]);
      const localPRs: LocalPR[] = await db.personalRecords.where("userId").equals(userId).toArray();

      const liveStats = computeDashboardStats(erg, water, team, dryland);
      setStats(liveStats);

      setPrCount(localPRs.length);

      // Build top PRs display from real data
      const HIGHLIGHT: { label: string; category: "erg" | "water"; dist: number }[] = [
        { label: "2k Erg",     category: "erg",   dist: 2000 },
        { label: "500m Erg",   category: "erg",   dist: 500  },
        { label: "500m Water", category: "water", dist: 500  },
        { label: "1k Erg",     category: "erg",   dist: 1000 },
      ];
      const displayed = HIGHLIGHT.map(({ label, category, dist }) => {
        const pr = localPRs.find(p => p.category === category && p.distance_m === dist);
        return pr ? { label, time_sec: pr.time_sec } : null;
      }).filter(Boolean) as PRDisplay[];
      if (displayed.length > 0) setTopPRs(displayed);
      const badges = new Set<BadgeKey>(["always"]);
      if (erg.some(s => s.distance_m === 500)) badges.add("has500");
      if (erg.length + water.length + team.length + dryland.length >= 10) badges.add("ten_sessions");
      if (localPRs.some(p => (p.improvement_sec ?? 0) > 0)) badges.add("pr_improved");
      if (erg.length >= 20) badges.add("erg_warrior");
      if (erg.some(s => s.distance_m === 2000)) badges.add("has_2k");
      if (liveStats.current_streak >= 7) badges.add("streak_7");
      if (team.length > 0) badges.add("team_session");
      setEarnedBadges(badges);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, isDemoMode]);

  async function handleSignOut() {
    if (isDemoMode) return;
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    router.push("/login");
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Athlete";
  const displayEmail = user?.email ?? "demo@paddleiq.com";
  const initials = displayName.slice(0, 1).toUpperCase();

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <LoadingAnnouncement label="Loading your profile" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Profile Card */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#0D9488] flex items-center justify-center text-2xl font-black text-white shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-lg font-black text-[#F1F5F9]">{displayName}</h1>
            <p className="text-sm text-[#8A98AC]">{displayEmail}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {isDemoMode && <Badge variant="default" className="text-[10px]">Demo Mode</Badge>}
              {!isDemoMode && <Badge variant="cyan" className="text-[10px]">Real Athlete</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#1E293B]">
          <div className="text-center">
            <div className="text-xl font-black text-[#F1F5F9]">{stats.total_sessions}</div>
            <div className="text-[10px] text-[#8A98AC]">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#F97316]">{stats.current_streak}</div>
            <div className="text-[10px] text-[#8A98AC]">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#F59E0B]">{prCount}</div>
            <div className="text-[10px] text-[#8A98AC]">PRs Set</div>
          </div>
        </div>
      </div>

      {/* Best PR Highlight */}
      <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award size={16} className="text-[#F59E0B]" />
          <span className="text-sm font-bold text-[#F59E0B]">Best Performances</span>
        </div>
        {topPRs.length === 0 ? (
          <p className="text-xs text-[#7C8AA0]">Log sessions to set your first PRs.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {topPRs.map((pr) => (
              <div key={pr.label} className="bg-[#0D1528] rounded-xl p-3 border border-[#1E293B]">
                <div className="text-[10px] text-[#8A98AC] uppercase">{pr.label}</div>
                <div className="text-lg font-black text-[#F1F5F9]">{formatTime(pr.time_sec)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Badges</h2>
        <div className="grid grid-cols-4 gap-2">
          {STATIC_BADGES.map((badge) => {
            const earned = earnedBadges.has(badge.key);
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-3 text-center transition-colors ${
                  earned ? "border-[#334155] bg-[#0D1528]" : "border-[#1E293B] opacity-85 grayscale"
                }`}
              >
                <div className="text-2xl mb-1">{badge.icon}</div>
                <div className="text-[9px] text-[#8A98AC] leading-tight">{badge.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] overflow-hidden">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider p-4 pb-2">Settings</h2>
        {[
          { icon: User,     label: "Edit Profile",   href: "#" },
          { icon: Bell,     label: "Notifications",  href: "#" },
          { icon: Shield,   label: "Privacy",        href: "#" },
          { icon: Settings, label: "App Settings",   href: "#" },
        ].map(({ icon: Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 px-4 py-3.5 border-t border-[#1E293B] hover:bg-[#1E293B] transition-colors"
          >
            <Icon size={16} className="text-[#7C8AA0]" />
            <span className="text-sm text-[#F1F5F9] flex-1">{label}</span>
            <ChevronRight size={14} className="text-[#7C8AA0]" />
          </Link>
        ))}
      </div>

      {/* About */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4 text-center">
        <div className="text-lg font-black gradient-text mb-1">PaddleIQ</div>
        <div className="text-xs text-[#7C8AA0]">Version 1.0.0 — Beta</div>
        <div className="text-xs text-[#7C8AA0] mt-1">Built for dragon boat athletes worldwide.</div>
      </div>

      <Button
        variant="ghost"
        className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10 w-full gap-2"
        onClick={handleSignOut}
        disabled={isDemoMode}
      >
        <LogOut size={16} />
        {isDemoMode ? "Sign Out (Demo — no account)" : "Sign Out"}
      </Button>
    </div>
  );
}
