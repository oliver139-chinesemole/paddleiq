"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Settings, Award, Bell, LogOut, ChevronRight, Shield, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockStats, mockPRs } from "@/lib/data/seed";
import { formatTime } from "@/lib/utils";

const BADGES = [
  { id: "b1", name: "First 500m Test", icon: "🎯", earned: true },
  { id: "b2", name: "10 Sessions", icon: "🔟", earned: true },
  { id: "b3", name: "PR Breaker", icon: "🚀", earned: true },
  { id: "b4", name: "Erg Warrior", icon: "💪", earned: true },
  { id: "b5", name: "Race Ready", icon: "🏆", earned: false },
  { id: "b6", name: "Consistency King", icon: "🔥", earned: false },
  { id: "b7", name: "Technique Student", icon: "📚", earned: true },
  { id: "b8", name: "Team Player", icon: "🐉", earned: false },
];

export default function ProfilePage() {
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Profile Card */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0EA5E9] to-[#0D9488] flex items-center justify-center text-2xl font-black text-white shrink-0">
            A
          </div>
          <div>
            <h1 className="text-lg font-black text-[#F1F5F9]">Demo Athlete</h1>
            <p className="text-sm text-[#64748B]">demo@paddleiq.com</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="default" className="text-[10px]">Competitive Racer</Badge>
              <Badge variant="cyan" className="text-[10px]">Left Side</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#1E293B]">
          <div className="text-center">
            <div className="text-xl font-black text-[#F1F5F9]">{mockStats.total_sessions}</div>
            <div className="text-[10px] text-[#64748B]">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#F97316]">{mockStats.current_streak}</div>
            <div className="text-[10px] text-[#64748B]">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#F59E0B]">{mockPRs.length}</div>
            <div className="text-[10px] text-[#64748B]">PRs Set</div>
          </div>
        </div>
      </div>

      {/* Best PR Highlight */}
      <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award size={16} className="text-[#F59E0B]" />
          <span className="text-sm font-bold text-[#F59E0B]">Best Performances</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "2k Erg", value: formatTime(512), sub: "8:32" },
            { label: "500m Erg", value: formatTime(118), sub: "1:58" },
            { label: "500m Water", value: formatTime(145), sub: "2:25" },
            { label: "1k Erg", value: formatTime(248), sub: "4:08" },
          ].map((pr) => (
            <div key={pr.label} className="bg-[#0D1528] rounded-xl p-3 border border-[#1E293B]">
              <div className="text-[10px] text-[#64748B] uppercase">{pr.label}</div>
              <div className="text-lg font-black text-[#F1F5F9]">{pr.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Badges</h2>
        <div className="grid grid-cols-4 gap-2">
          {BADGES.map((badge) => (
            <div
              key={badge.id}
              className={`rounded-xl border p-3 text-center transition-colors ${
                badge.earned
                  ? "border-[#334155] bg-[#0D1528]"
                  : "border-[#1E293B] opacity-40"
              }`}
            >
              <div className="text-2xl mb-1">{badge.icon}</div>
              <div className="text-[9px] text-[#64748B] leading-tight">{badge.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] overflow-hidden">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider p-4 pb-2">Settings</h2>
        {[
          { icon: User, label: "Edit Profile", href: "#" },
          { icon: Bell, label: "Notifications", href: "#" },
          { icon: Shield, label: "Privacy", href: "#" },
          { icon: Settings, label: "App Settings", href: "#" },
        ].map(({ icon: Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 px-4 py-3.5 border-t border-[#1E293B] hover:bg-[#1E293B] transition-colors"
          >
            <Icon size={16} className="text-[#475569]" />
            <span className="text-sm text-[#F1F5F9] flex-1">{label}</span>
            <ChevronRight size={14} className="text-[#475569]" />
          </Link>
        ))}
      </div>

      {/* About */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4 text-center">
        <div className="text-lg font-black gradient-text mb-1">PaddleIQ</div>
        <div className="text-xs text-[#475569]">Version 1.0.0 — Beta</div>
        <div className="text-xs text-[#475569] mt-1">Built for dragon boat athletes worldwide.</div>
      </div>

      <Button variant="ghost" className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10 w-full gap-2">
        <LogOut size={16} />
        Sign Out
      </Button>
    </div>
  );
}
