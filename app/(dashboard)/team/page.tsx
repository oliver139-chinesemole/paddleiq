"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, ChevronRight, UserPlus, Loader2,
  Copy, Check, X, Shield, Zap, Flame, Anchor, Cpu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";
import type { PerformanceRole } from "@/lib/types";
import ScheduleTab from "@/components/team/ScheduleTab";
import LineupsTab from "@/components/team/LineupsTab";
import CoachAthleteView from "@/components/team/CoachAthleteView";
import FeedTab from "@/components/team/FeedTab";
import LeaderboardTab from "@/components/team/LeaderboardTab";

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_TEAM = {
  id: "demo",
  name: "Thunder Dragons",
  coach_id: "demo-coach",
  invite_code: "td2026",
  members: [
    { id: "m1", user_id: "m1", full_name: "Alex Chen",     paddle_side: "left",  seat_number: 1,  role_in_team: "paddler", performance_role: "pacer_stroke" as PerformanceRole, weight_kg: 72, joined_at: "2026-01-01" },
    { id: "m2", user_id: "m2", full_name: "Jordan Kim",    paddle_side: "right", seat_number: 2,  role_in_team: "paddler", performance_role: "engine_room"  as PerformanceRole, weight_kg: 80, joined_at: "2026-01-01" },
    { id: "m3", user_id: "m3", full_name: "Sam Rivera",    paddle_side: "left",  seat_number: 3,  role_in_team: "paddler", performance_role: "rocket"       as PerformanceRole, weight_kg: 68, joined_at: "2026-01-01" },
    { id: "m4", user_id: "m4", full_name: "Taylor Nguyen", paddle_side: "right", seat_number: 4,  role_in_team: "paddler", performance_role: "engine_room"  as PerformanceRole, weight_kg: 85, joined_at: "2026-01-01" },
    { id: "m5", user_id: "m5", full_name: "Morgan Liu",    paddle_side: "left",  seat_number: 5,  role_in_team: "coach",   performance_role: undefined,                         weight_kg: 70, joined_at: "2026-01-01" },
  ],
};

const DEMO_LB = [
  { user_id: "m3", name: "Sam Rivera",    time_sec: 117 },
  { user_id: "m1", name: "Alex Chen",     time_sec: 118 },
  { user_id: "m5", name: "Morgan Liu",    time_sec: 120 },
  { user_id: "m2", name: "Jordan Kim",    time_sec: 121 },
  { user_id: "m4", name: "Taylor Nguyen", time_sec: 125 },
];

// ── Types ─────────────────────────────────────────────────────────────────────

// Declared explicitly rather than inferred from DEMO_TEAM: the fixtures fill in
// every field, so inference made seat_number, weight_kg and performance_role
// look non-nullable when the database allows all three to be empty.
type Member = {
  id: string;
  user_id: string;
  full_name: string;
  paddle_side: string;
  seat_number: number | null;
  role_in_team: string;
  performance_role?: PerformanceRole;
  weight_kg: number | null;
  joined_at: string;
};

const PERFORMANCE_ROLES: readonly PerformanceRole[] = [
  "pacer_stroke", "engine_room", "rocket", "tech",
];

/** Narrows the free-form column to the union, dropping anything unrecognised. */
function asPerformanceRole(value: string | null): PerformanceRole | undefined {
  return PERFORMANCE_ROLES.includes(value as PerformanceRole)
    ? (value as PerformanceRole)
    : undefined;
}

type Team = {
  id: string;
  name: string;
  coach_id: string;
  invite_code: string;
  members: Member[];
};


// ── Performance role helpers ──────────────────────────────────────────────────
const PERF_ROLES: { value: PerformanceRole; label: string; icon: React.ElementType; color: string }[] = [
  { value: "pacer_stroke", label: "Pacer / Stroke", icon: Zap,    color: "#F59E0B" },
  { value: "engine_room",  label: "Engine Room",    icon: Cpu,    color: "#0EA5E9" },
  { value: "rocket",       label: "Rocket",         icon: Flame,  color: "#EF4444" },
  { value: "tech",         label: "Technician",     icon: Anchor, color: "#10B981" },
];

function perfRoleInfo(role?: PerformanceRole | null) {
  return PERF_ROLES.find(r => r.value === role);
}

// ── Athlete modal ─────────────────────────────────────────────────────────────
function AthleteModal({
  member, isCoach, teamId, coachId, isDemoMode, onClose, onRoleChange,
}: {
  member: Member;
  isCoach: boolean;
  teamId: string;
  coachId: string;
  isDemoMode: boolean;
  onClose: () => void;
  onRoleChange: (userId: string, role: PerformanceRole | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const info = perfRoleInfo(member.performance_role);

  async function setRole(role: PerformanceRole | null) {
    setSaving(true);
    await onRoleChange(member.user_id, role);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#0D1528] rounded-t-2xl border-t border-[#1E293B] p-6 pb-10 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center text-lg font-black text-[#94A3B8]">
              {member.full_name.charAt(0)}
            </div>
            <div>
              <div className="font-black text-[#F1F5F9]">{member.full_name}</div>
              <div className="text-xs text-[#8A98AC] capitalize">
                {member.role_in_team} · {member.paddle_side} side
                {member.seat_number ? ` · Seat ${member.seat_number}` : ""}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#7C8AA0] hover:text-[#94A3B8]">
            <X size={20} />
          </button>
        </div>

        {/* Current performance role */}
        {info ? (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ backgroundColor: `${info.color}15` }}>
            <info.icon size={16} style={{ color: info.color }} />
            <span className="text-sm font-semibold" style={{ color: info.color }}>{info.label}</span>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-[#1E293B] text-xs text-[#7C8AA0]">No performance role assigned</div>
        )}

        {/* Weight */}
        {member.weight_kg && (
          <div className="flex items-center gap-2 mb-4 text-sm text-[#8A98AC]">
            <Shield size={14} />
            <span>{member.weight_kg} kg</span>
          </div>
        )}

        {/* Coach: training flags + workout assignment */}
        {isCoach && (
          <CoachAthleteView
            teamId={teamId}
            coachId={coachId}
            athleteId={member.user_id}
            athleteName={member.full_name}
            isDemoMode={isDemoMode}
          />
        )}

        {/* Role assignment (coach only) */}
        {isCoach && (
          <div className="mt-4 pt-4 border-t border-[#1E293B]">
            <p className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Performance Role</p>
            <div className="grid grid-cols-2 gap-2">
              {PERF_ROLES.map(r => (
                <button
                  key={r.value}
                  disabled={saving}
                  onClick={() => setRole(member.performance_role === r.value ? null : r.value)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${
                    member.performance_role === r.value
                      ? "border-opacity-60 text-white"
                      : "border-[#1E293B] text-[#8A98AC] hover:border-[#334155]"
                  }`}
                  style={member.performance_role === r.value
                    ? { borderColor: r.color, backgroundColor: `${r.color}20`, color: r.color }
                    : {}}
                >
                  <r.icon size={14} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Side-balance summary ──────────────────────────────────────────────────────
function SideBalance({ members }: { members: Member[] }) {
  const left  = members.filter(m => m.paddle_side === "left").length;
  const right = members.filter(m => m.paddle_side === "right").length;
  const both  = members.filter(m => m.paddle_side === "both").length;
  const total = members.length;
  const leftPct = total > 0 ? (left / total) * 100 : 50;

  return (
    <div className="rounded-xl bg-[#111827] border border-[#1E293B] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider">Side Balance</span>
        {both > 0 && <span className="text-[10px] text-[#7C8AA0]">{both} switch-hitter{both > 1 ? "s" : ""}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm font-bold text-[#0EA5E9]">{left}L</div>
        <div className="flex-1 h-3 rounded-full bg-[#1E293B] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#0EA5E9] to-[#06B6D4] rounded-full transition-all"
            style={{ width: `${leftPct}%` }}
          />
        </div>
        <div className="text-sm font-bold text-[#06B6D4]">{right}R</div>
      </div>
      {total > 0 && (
        <div className="text-[10px] text-[#7C8AA0] mt-1.5 text-center">
          {left === right ? "✓ Perfectly balanced" :
           left > right ? `${left - right} more left-side paddlers` :
           `${right - left} more right-side paddlers`}
        </div>
      )}
    </div>
  );
}

// ── Create / Join forms ───────────────────────────────────────────────────────
function NoTeamView({ userId, onJoined }: { userId: string; onJoined: () => void }) {
  const [mode, setMode] = useState<null | "create" | "join">(null);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function createTeam() {
    if (!teamName.trim()) return;
    setBusy(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data: team, error } = await sb
        .from("teams")
        .insert({ name: teamName.trim(), coach_id: userId })
        .select("id, invite_code")
        .single();
      if (error || !team) throw error ?? new Error("No team returned");
      await sb.from("team_members").insert({ team_id: team.id, user_id: userId, role_in_team: "coach" });
      await sb.from("profiles").update({ team_id: team.id }).eq("id", userId);
      toast.success("Team created!");
      onJoined();
    } catch {
      toast.error("Failed to create team. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function joinTeam() {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data: team } = await sb.from("teams").select("id, name").eq("invite_code", joinCode.trim().toLowerCase()).single();
      if (!team) { toast.error("Team code not found."); return; }
      const { data: myProfile } = await sb.from("profiles").select("full_name").eq("id", userId).single();
      await sb.from("team_members").insert({ team_id: team.id, user_id: userId });
      await sb.from("profiles").update({ team_id: team.id }).eq("id", userId);
      // Auto-post to team feed
      const joinerName = myProfile?.full_name ?? "Someone";
      try { await sb.from("team_feed").insert({ team_id: team.id, author_id: userId, post_type: "new_member", content: `${joinerName} joined the team! Welcome 🐉`, metadata: {} }); } catch { /* non-fatal */ }
      toast.success(`Joined ${team.name}!`);
      onJoined();
    } catch {
      toast.error("Failed to join team. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "create") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-[#F1F5F9]">Create a Team</h2>
        <Input label="Team name" placeholder="Thunder Dragons" value={teamName} onChange={e => setTeamName(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode(null)} disabled={busy} className="flex-1">Cancel</Button>
          <Button onClick={createTeam} disabled={busy || !teamName.trim()} className="flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Create"}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-[#F1F5F9]">Join with Team Code</h2>
        <Input label="Team code" placeholder="e.g. td2026" value={joinCode} onChange={e => setJoinCode(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode(null)} disabled={busy} className="flex-1">Cancel</Button>
          <Button onClick={joinTeam} disabled={busy || !joinCode.trim()} className="flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Join"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1E293B] flex items-center justify-center">
        <Users size={28} className="text-[#7C8AA0]" />
      </div>
      <h2 className="text-lg font-bold text-[#F1F5F9]">No team yet</h2>
      <p className="text-sm text-[#8A98AC] max-w-xs">Create a team to manage your squad and track progress together.</p>
      <Button className="w-full max-w-xs" onClick={() => setMode("create")}><Plus size={16} /> Create a Team</Button>
      <Button variant="outline" className="w-full max-w-xs" onClick={() => setMode("join")}><UserPlus size={16} /> Join with Team Code</Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { user, userId, isDemoMode } = useUser();
  const [tab, setTab] = useState<"roster" | "schedule" | "lineups" | "leaderboard" | "feed">("roster");
  const [team, setTeam] = useState<Team | null>(null);
  const [topErgTime, setTopErgTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [selected, setSelected] = useState<Member | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTeam = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();

      const { data: profile } = await sb.from("profiles").select("team_id").eq("id", userId).single();
      if (!profile?.team_id) { setTeam(null); return; }

      const [{ data: teamData }, { data: membersData }] = await Promise.all([
        sb.from("teams").select("id, name, coach_id, invite_code").eq("id", profile.team_id).single(),
        sb.from("team_members")
          .select("id, user_id, seat_number, paddle_side, role_in_team, performance_role, weight_kg, joined_at, profiles(full_name)")
          .eq("team_id", profile.team_id),
      ]);

      if (!teamData) { setTeam(null); return; }

      type ProfileRef = { full_name: string | null };
      type MemberRow = {
        id: string; user_id: string; seat_number: number | null;
        paddle_side: string | null; role_in_team: string | null;
        performance_role: string | null; weight_kg: number | null;
        joined_at: string;
        // PostgREST returns a many-to-one embed as an object while its
        // generated types call it an array. Accept either.
        profiles: ProfileRef | ProfileRef[] | null;
      };
      const rows = (membersData ?? []) as unknown as MemberRow[];
      const members: Member[] = rows.map((m: MemberRow) => ({
        id: m.id,
        user_id: m.user_id,
        full_name:
          (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)?.full_name ?? "Athlete",
        paddle_side: m.paddle_side ?? "left",
        seat_number: m.seat_number ?? null,
        role_in_team: m.role_in_team ?? "paddler",
        performance_role: asPerformanceRole(m.performance_role),
        weight_kg: m.weight_kg ?? null,
        joined_at: m.joined_at,
      }));

      setTeam({ id: teamData.id, name: teamData.name, coach_id: teamData.coach_id, invite_code: teamData.invite_code ?? "", members });

      // Load top 500m PR for header stat only
      const userIds = members.map(m => m.user_id);
      if (userIds.length > 0) {
        const { data: top500 } = await sb
          .from("personal_records")
          .select("user_id, time_sec")
          .in("user_id", userIds)
          .eq("category", "erg")
          .eq("distance_m", 500)
          .order("time_sec", { ascending: true })
          .limit(1);
        if (top500?.[0]) setTopErgTime(top500[0].time_sec);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return;
    loadTeam();
  }, [loadTeam, isDemoMode]);

  async function updatePerfRole(memberId: string, role: PerformanceRole | null) {
    if (isDemoMode) return;
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    await sb.from("team_members").update({ performance_role: role }).eq("user_id", memberId).eq("team_id", activeTeam.id);
    await loadTeam();
    if (selected?.user_id === memberId) setSelected(s => s ? { ...s, performance_role: role ?? undefined } : null);
    toast.success("Role updated");
  }

  function copyInviteLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render: Demo ──────────────────────────────────────────────────────────
  const activeTeam: Team = isDemoMode
    ? { ...DEMO_TEAM, members: DEMO_TEAM.members as unknown as Member[] }
    : (team ?? { id: "", name: "", coach_id: "", invite_code: "", members: [] });

  const isCoach = isDemoMode ? true : userId === activeTeam.coach_id;

  if (!isDemoMode && loading) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <h1 className="text-2xl font-black text-[#F1F5F9]">Team</h1>
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 size={28} className="text-[#0EA5E9] animate-spin" />
        </div>
      </div>
    );
  }

  if (!isDemoMode && !team) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <h1 className="text-2xl font-black text-[#F1F5F9]">Team</h1>
        <NoTeamView userId={userId} onJoined={loadTeam} />
      </div>
    );
  }

  const headerTop500 = isDemoMode ? DEMO_LB[0]?.time_sec : topErgTime;

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* ── Team Header ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#F97316]/20 to-[#0D1528] border border-[#F97316]/30 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-[#F97316]/30 flex items-center justify-center shrink-0">
            <span className="text-2xl">🐉</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-[#F1F5F9] truncate">{activeTeam.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {isCoach && <Badge variant="warning" className="text-[10px]">Coach</Badge>}
              <span className="text-xs text-[#7C8AA0]">Code:</span>
              <span className="text-xs font-mono font-bold text-[#F59E0B]">{activeTeam.invite_code}</span>
            </div>
          </div>
          {/* Copy invite link */}
          <button
            onClick={() => copyInviteLink(activeTeam.invite_code)}
            className="flex items-center gap-1.5 bg-[#F97316]/20 text-[#F97316] text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-[#F97316]/30 transition-colors shrink-0"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Invite"}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-[#F1F5F9]">{activeTeam.members.length}</div>
            <div className="text-[10px] text-[#8A98AC]">Athletes</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#0EA5E9]">
              {activeTeam.members.filter(m => m.paddle_side === "left").length}L /&nbsp;
              {activeTeam.members.filter(m => m.paddle_side === "right").length}R
            </div>
            <div className="text-[10px] text-[#8A98AC]">Side Balance</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#10B981]">
              {headerTop500 ? formatTime(headerTop500) : "—"}
            </div>
            <div className="text-[10px] text-[#8A98AC]">Top 500m</div>
          </div>
        </div>
      </div>

      {/* ── Tabs (scrollable on narrow screens) ─────────────────────────── */}
      <div className="flex gap-1 bg-[#0D1528] border border-[#1E293B] rounded-xl p-1 overflow-x-auto no-scrollbar">
        {(["roster", "schedule", "lineups", "leaderboard", "feed"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer capitalize ${
              tab === t ? "bg-[#1E293B] text-[#F1F5F9]" : "text-[#7C8AA0] hover:text-[#94A3B8]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Roster Tab ───────────────────────────────────────────────────── */}
      {tab === "roster" && (
        <div className="flex flex-col gap-3">
          <SideBalance members={activeTeam.members} />

          {activeTeam.members.length === 0 ? (
            <p className="text-sm text-[#7C8AA0] text-center py-6">No members yet. Share your invite link!</p>
          ) : (
            activeTeam.members.map(m => {
              const perf = perfRoleInfo(m.performance_role);
              return (
                <button
                  key={m.user_id}
                  onClick={() => setSelected(m)}
                  className="flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4 text-left hover:border-[#334155] transition-colors w-full"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-sm font-bold text-[#94A3B8] shrink-0">
                    {m.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#F1F5F9]">{m.full_name}</span>
                      {m.seat_number && <Badge variant="secondary" className="text-[10px]">Seat {m.seat_number}</Badge>}
                      <Badge variant={m.paddle_side === "left" ? "default" : "cyan"} className="text-[10px] capitalize">{m.paddle_side}</Badge>
                      {m.role_in_team === "coach" && <Badge variant="warning" className="text-[10px]">Coach</Badge>}
                    </div>
                    {perf && (
                      <div className="flex items-center gap-1 mt-1">
                        <perf.icon size={11} style={{ color: perf.color }} />
                        <span className="text-[11px]" style={{ color: perf.color }}>{perf.label}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-[#7C8AA0] shrink-0" />
                </button>
              );
            })
          )}

          {/* Invite row */}
          <button
            onClick={() => copyInviteLink(activeTeam.invite_code)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#334155] p-4 text-sm text-[#8A98AC] hover:border-[#7C8AA0] transition-colors w-full"
          >
            {copied ? <Check size={14} className="text-[#10B981]" /> : <UserPlus size={14} />}
            {copied ? "Invite link copied!" : "Copy invite link to add athletes"}
          </button>
        </div>
      )}

      {/* ── Schedule Tab (Phase 2.3) ─────────────────────────────────────── */}
      {tab === "schedule" && (
        <ScheduleTab
          teamId={activeTeam.id}
          userId={userId}
          isCoach={isCoach}
          isDemoMode={isDemoMode}
          members={activeTeam.members.map(m => ({ user_id: m.user_id, paddle_side: m.paddle_side }))}
        />
      )}

      {/* ── Lineups Tab (Phase 2.4) ───────────────────────────────────────── */}
      {tab === "lineups" && (
        <LineupsTab
          teamId={activeTeam.id}
          userId={userId}
          isCoach={isCoach}
          isDemoMode={isDemoMode}
          members={activeTeam.members.map(m => ({
            user_id: m.user_id,
            full_name: m.full_name,
            paddle_side: m.paddle_side,
            weight_kg: m.weight_kg,
            performance_role: m.performance_role,
          }))}
        />
      )}

      {/* ── Leaderboard Tab (Phase 2.6) ───────────────────────────────────── */}
      {tab === "leaderboard" && (
        <LeaderboardTab
          teamId={activeTeam.id}
          userId={userId}
          isDemoMode={isDemoMode}
          memberIds={activeTeam.members.map(m => m.user_id)}
          memberNames={Object.fromEntries(activeTeam.members.map(m => [m.user_id, m.full_name]))}
        />
      )}

      {/* ── Feed Tab (Phase 2.6) ─────────────────────────────────────────── */}
      {tab === "feed" && (
        <FeedTab
          teamId={activeTeam.id}
          userId={userId}
          authorName={user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Athlete"}
          isCoach={isCoach}
          isDemoMode={isDemoMode}
        />
      )}

      {/* ── Athlete modal ─────────────────────────────────────────────────── */}
      {selected && (
        <AthleteModal
          member={selected}
          isCoach={isCoach}
          teamId={activeTeam.id}
          coachId={activeTeam.coach_id}
          isDemoMode={isDemoMode}
          onClose={() => setSelected(null)}
          onRoleChange={updatePerfRole}
        />
      )}
    </div>
  );
}
