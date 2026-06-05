"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Trophy, ChevronRight, Crown, UserPlus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";

// ── Demo data (shown when Supabase not configured) ────────────────────────────
const DEMO_TEAM = {
  name: "Thunder Dragons",
  coach: "Coach Sarah Leung",
  invite_code: "td2026",
  members: [
    { id: "m1", name: "Alex Chen",      side: "Left",  seat: 1, role: "Paddler",      erg500: "1:58", streak: 12 },
    { id: "m2", name: "Jordan Kim",     side: "Right", seat: 2, role: "Paddler",      erg500: "2:01", streak: 8  },
    { id: "m3", name: "Sam Rivera",     side: "Left",  seat: 3, role: "Paddler",      erg500: "1:55", streak: 15 },
    { id: "m4", name: "Taylor Nguyen",  side: "Right", seat: 4, role: "Paddler",      erg500: "2:05", streak: 5  },
    { id: "m5", name: "Morgan Liu",     side: "Left",  seat: 5, role: "Paddler",      erg500: "2:00", streak: 10 },
  ],
  announcements: [
    { id: "a1", text: "Practice this Saturday at 7am — all paddlers required. Bring race gear.",                                              time: "2 hours ago",  author: "Coach Sarah" },
    { id: "a2", text: "Erg test scores due by Friday. Upload your 500m result to the team page.",                                            time: "1 day ago",    author: "Coach Sarah" },
    { id: "a3", text: "Great practice yesterday everyone! The starts are looking much better. Let's keep the energy for Saturday.",           time: "2 days ago",   author: "Coach Sarah" },
  ],
};

type RealMember = {
  user_id: string;
  full_name: string;
  paddle_side: string;
  seat_number: number | null;
  role_in_team: string;
};

type RealTeam = {
  id: string;
  name: string;
  invite_code: string;
  members: RealMember[];
};

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
      const { data: team, error } = await sb.from("teams").insert({ name: teamName.trim(), coach_id: userId }).select("id, invite_code").single();
      if (error || !team) throw error ?? new Error("No team returned");
      await sb.from("team_members").insert({ team_id: team.id, user_id: userId, role_in_team: "coach" });
      await sb.from("profiles").update({ team_id: team.id }).eq("id", userId);
      toast.success("Team created!");
      onJoined();
    } catch (e) {
      toast.error("Failed to create team. Try again.");
      console.error(e);
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
      const { data: team, error } = await sb.from("teams").select("id, name").eq("invite_code", joinCode.trim().toLowerCase()).single();
      if (error || !team) { toast.error("Team code not found."); return; }
      await sb.from("team_members").insert({ team_id: team.id, user_id: userId });
      await sb.from("profiles").update({ team_id: team.id }).eq("id", userId);
      toast.success(`Joined ${team.name}!`);
      onJoined();
    } catch (e) {
      toast.error("Failed to join team. Try again.");
      console.error(e);
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
        <Users size={28} className="text-[#475569]" />
      </div>
      <h2 className="text-lg font-bold text-[#F1F5F9]">No team yet</h2>
      <p className="text-sm text-[#64748B] max-w-xs">Create a team to manage your squad and track progress together.</p>
      <Button className="w-full max-w-xs" onClick={() => setMode("create")}>
        <Plus size={16} /> Create a Team
      </Button>
      <Button variant="outline" className="w-full max-w-xs" onClick={() => setMode("join")}>
        <UserPlus size={16} /> Join with Team Code
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { userId, isDemoMode } = useUser();
  const [tab, setTab] = useState<"roster" | "leaderboard" | "announcements">("roster");
  const [team, setTeam] = useState<RealTeam | null>(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const [announcement, setAnnouncement] = useState("");

  async function loadTeam() {
    if (isDemoMode) return;
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();

      // Get team_id from profile
      const { data: profile } = await sb.from("profiles").select("team_id").eq("id", userId).single();
      if (!profile?.team_id) { setTeam(null); return; }

      // Load team info + members
      const [{ data: teamData }, { data: membersData }] = await Promise.all([
        sb.from("teams").select("id, name, invite_code").eq("id", profile.team_id).single(),
        sb.from("team_members")
          .select("user_id, seat_number, paddle_side, role_in_team, profiles(full_name)")
          .eq("team_id", profile.team_id),
      ]);

      if (!teamData) { setTeam(null); return; }

      setTeam({
        id: teamData.id,
        name: teamData.name,
        invite_code: teamData.invite_code ?? "",
        members: (membersData ?? []).map((m: any) => ({
          user_id: m.user_id,
          full_name: m.profiles?.full_name ?? "Athlete",
          paddle_side: m.paddle_side ?? "left",
          seat_number: m.seat_number ?? null,
          role_in_team: m.role_in_team ?? "paddler",
        })),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTeam(); }, [userId, isDemoMode]);

  // ── Demo mode renders exactly as before ────────────────────────────────────
  if (isDemoMode) {
    return <DemoTeamView tab={tab} setTab={setTab} />;
  }

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <h1 className="text-2xl font-black text-[#F1F5F9]">Team</h1>
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 size={28} className="text-[#0EA5E9] animate-spin" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <h1 className="text-2xl font-black text-[#F1F5F9]">Team</h1>
        <NoTeamView userId={userId} onJoined={loadTeam} />
      </div>
    );
  }

  // ── Real team view ─────────────────────────────────────────────────────────
  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Team Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#F97316]/20 to-[#0D1528] border border-[#F97316]/30 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[#F97316]/30 flex items-center justify-center">
            <span className="text-2xl">🐉</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-[#F1F5F9]">{team.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#475569]">Code:</span>
              <span className="text-xs font-mono font-bold text-[#F59E0B]">{team.invite_code}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-center mt-3">
          <div>
            <div className="text-lg font-bold text-[#F1F5F9]">{team.members.length}</div>
            <div className="text-[10px] text-[#64748B]">Athletes</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0D1528] border border-[#1E293B] rounded-xl p-1">
        {(["roster", "announcements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer capitalize ${
              tab === t ? "bg-[#1E293B] text-[#F1F5F9]" : "text-[#475569] hover:text-[#94A3B8]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Roster Tab */}
      {tab === "roster" && (
        <div className="flex flex-col gap-3">
          {team.members.length === 0 ? (
            <p className="text-sm text-[#475569] text-center py-6">No members yet. Share your team code!</p>
          ) : team.members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-4 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4">
              <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-sm font-bold text-[#94A3B8] shrink-0">
                {m.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#F1F5F9]">{m.full_name}</span>
                  {m.seat_number && <Badge variant="secondary" className="text-[10px]">Seat {m.seat_number}</Badge>}
                  <Badge variant={m.paddle_side === "left" ? "default" : "cyan"} className="text-[10px] capitalize">
                    {m.paddle_side}
                  </Badge>
                </div>
                <div className="text-xs text-[#64748B] mt-1 capitalize">{m.role_in_team}</div>
              </div>
              <ChevronRight size={14} className="text-[#475569]" />
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-[#334155] p-4 text-center">
            <p className="text-xs text-[#64748B] mb-2">Share invite code to add teammates:</p>
            <p className="text-base font-mono font-bold text-[#F59E0B]">{team.invite_code}</p>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
      {tab === "announcements" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[#475569] text-center py-4">Announcements coming soon.</p>
          <div className="rounded-xl border border-dashed border-[#334155] p-4">
            <Input
              placeholder="Write an announcement…"
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
            />
            <Button className="w-full mt-2" size="sm" disabled>Post Announcement</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Demo team view (extracted to keep main component clean) ───────────────────
function DemoTeamView({ tab, setTab }: { tab: string; setTab: (t: "roster" | "leaderboard" | "announcements") => void }) {
  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-br from-[#F97316]/20 to-[#0D1528] border border-[#F97316]/30 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[#F97316]/30 flex items-center justify-center">
            <span className="text-2xl">🐉</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-[#F1F5F9]">{DEMO_TEAM.name}</h1>
            <div className="flex items-center gap-1.5">
              <Crown size={12} className="text-[#F59E0B]" />
              <span className="text-xs text-[#94A3B8]">{DEMO_TEAM.coach}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-center mt-3">
          <div>
            <div className="text-lg font-bold text-[#F1F5F9]">{DEMO_TEAM.members.length}</div>
            <div className="text-[10px] text-[#64748B]">Athletes</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#10B981]">4/5</div>
            <div className="text-[10px] text-[#64748B]">Active</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#0EA5E9]">3</div>
            <div className="text-[10px] text-[#64748B]">New PRs</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-[#0D1528] border border-[#1E293B] rounded-xl p-1">
        {(["roster", "leaderboard", "announcements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer capitalize ${
              tab === t ? "bg-[#1E293B] text-[#F1F5F9]" : "text-[#475569] hover:text-[#94A3B8]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="flex flex-col gap-3">
          {DEMO_TEAM.members.map((member) => (
            <div key={member.id} className="flex items-center gap-4 rounded-xl border border-[#1E293B] bg-[#0D1528] p-4">
              <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-sm font-bold text-[#94A3B8] shrink-0">
                {member.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#F1F5F9]">{member.name}</span>
                  <Badge variant="secondary" className="text-[10px]">Seat {member.seat}</Badge>
                  <Badge variant={member.side === "Left" ? "default" : "cyan"} className="text-[10px]">{member.side}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[#64748B]">
                  <span>500m: {member.erg500}</span>
                  <span>·</span>
                  <span>🔥 {member.streak} day streak</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-[#475569]" />
            </div>
          ))}
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} className="text-[#F59E0B]" />
            <h2 className="text-sm font-bold text-[#F1F5F9]">500m Erg Leaderboard</h2>
          </div>
          {[...DEMO_TEAM.members]
            .sort((a, b) => a.erg500.localeCompare(b.erg500))
            .map((member, i) => (
              <div key={member.id} className={`flex items-center gap-4 rounded-xl border p-4 ${
                i === 0 ? "border-[#F59E0B]/30 bg-[#F59E0B]/10" : "border-[#1E293B] bg-[#0D1528]"
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                  i === 0 ? "bg-[#F59E0B] text-[#0A0F1E]" :
                  i === 1 ? "bg-[#94A3B8] text-[#0A0F1E]" :
                  i === 2 ? "bg-[#CD7C2B] text-[#0A0F1E]" :
                  "bg-[#1E293B] text-[#64748B]"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#F1F5F9]">{member.name}</div>
                  <div className="text-xs text-[#64748B]">Seat {member.seat} · {member.side}</div>
                </div>
                <div className="text-right">
                  <div className={`text-base font-black ${i === 0 ? "text-[#F59E0B]" : "text-[#F1F5F9]"}`}>{member.erg500}</div>
                  <div className="text-[10px] text-[#64748B]">500m erg</div>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === "announcements" && (
        <div className="flex flex-col gap-3">
          {DEMO_TEAM.announcements.map((ann) => (
            <div key={ann.id} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={12} className="text-[#F59E0B]" />
                <span className="text-xs font-semibold text-[#94A3B8]">{ann.author}</span>
                <span className="text-[10px] text-[#475569] ml-auto">{ann.time}</span>
              </div>
              <p className="text-sm text-[#F1F5F9] leading-relaxed">{ann.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
