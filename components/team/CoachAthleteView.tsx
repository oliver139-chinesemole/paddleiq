"use client";

/**
 * Coach-only per-athlete view.
 * Reads the athlete's Supabase-synced sessions (via coach-reads-sessions RLS),
 * runs the deterministic rules engine, and shows flags + workout assignment.
 */
import { useState, useEffect } from "react";
import {
  AlertTriangle, CheckCircle, TrendingDown, Loader2,
  Dumbbell, Droplets, Activity, Users, Plus, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { RenderedInsight } from "@/lib/coach/engine";

// ── Demo flags ────────────────────────────────────────────────────────────────
const DEMO_FLAGS: RenderedInsight[] = [
  { kind: "split-fade",            severity: "warn",   title: "2k Erg Split Fade",        body: "Last 500m is 4s slower than the first. Work on pacing discipline." },
  { kind: "training-load",         severity: "ok",     title: "Training Load Normal",      body: "ACWR 1.05 — right in the safe band. Good chronic base." },
  { kind: "high-rpe-streak",       severity: "warn",   title: "3-Session High-RPE Streak", body: "RPE ≥8 three sessions in a row. Schedule a technique or recovery session next." },
  { kind: "modality-gap",          severity: "ok",     title: "Dryland Up To Date",        body: "Last dryland session was 5 days ago — within threshold." },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type WorkoutType = "erg" | "water" | "dryland" | "team" | "rest";

const WORKOUT_ICONS: Record<WorkoutType, React.ElementType> = {
  erg: Dumbbell, water: Droplets, dryland: Activity, team: Users, rest: CheckCircle,
};
const WORKOUT_COLORS: Record<WorkoutType, string> = {
  erg: "#0EA5E9", water: "#06B6D4", dryland: "#10B981", team: "#F97316", rest: "#64748B",
};

// ── CoachAthleteView ──────────────────────────────────────────────────────────
export default function CoachAthleteView({
  teamId, coachId, athleteId, athleteName, isDemoMode,
}: {
  teamId: string;
  coachId: string;
  athleteId: string;
  athleteName: string;
  isDemoMode: boolean;
}) {
  const [flags, setFlags] = useState<RenderedInsight[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [assignments, setAssignments] = useState<{ id: string; title: string; workout_type: WorkoutType; target_date?: string; completed: boolean }[]>([]);
  const [form, setForm] = useState({ title: "", type: "erg" as WorkoutType, date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setFlags(DEMO_FLAGS);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const sb = createClient();

        // Fetch athlete sessions via coach-reads-sessions RLS
        const [ergRes, waterRes, drylandRes, teamRes, prRes, assignRes] = await Promise.all([
          sb.from("erg_sessions").select("date, rpe, duration_sec, distance_m, split_sec").eq("user_id", athleteId).order("date", { ascending: false }).limit(60),
          sb.from("water_sessions").select("date, rpe, duration_sec, distance_m, avg_pace_sec").eq("user_id", athleteId).order("date", { ascending: false }).limit(30),
          sb.from("dryland_sessions").select("date, rpe, duration_min").eq("user_id", athleteId).order("date", { ascending: false }).limit(30),
          sb.from("team_sessions").select("date, rpe, duration_min").eq("user_id", athleteId).order("date", { ascending: false }).limit(30),
          sb.from("personal_records").select("category, distance_m, time_sec").eq("user_id", athleteId),
          sb.from("workout_assignments").select("id, title, workout_type, target_date, completed").eq("team_id", teamId).eq("assigned_to", athleteId).order("created_at", { ascending: false }).limit(10),
        ]);

        setAssignments((assignRes.data ?? []) as typeof assignments);

        const { runCoachEngine } = await import("@/lib/coach/engine");
        const result = runCoachEngine({
          ergSessions: (ergRes.data ?? []).map((s: any) => ({
            date: s.date, rpe: s.rpe ?? 7, duration_sec: s.duration_sec,
            distance_m: s.distance_m, split_sec: s.split_sec ?? 0,
          })),
          waterSessions: (waterRes.data ?? []).map((s: any) => ({
            date: s.date, rpe: s.rpe ?? 6, duration_sec: s.duration_sec,
            distance_m: s.distance_m, avg_pace_sec: s.avg_pace_sec ?? 0,
          })),
          drylandSessions: (drylandRes.data ?? []).map((s: any) => ({
            date: s.date, rpe: s.rpe ?? 6, duration_min: s.duration_min ?? 0,
          })),
          teamSessions: (teamRes.data ?? []).map((s: any) => ({
            date: s.date, rpe: s.rpe ?? 6, duration_min: s.duration_min ?? 0,
          })),
          prs: (prRes.data ?? []).map((p: any) => ({
            category: p.category, distance_m: p.distance_m, time_sec: p.time_sec,
          })),
        });

        const allFlags: RenderedInsight[] = [
          ...result.warnings,
          ...result.suggestions,
          ...result.positives.filter(p => p.severity === "ok"),
        ].slice(0, 6);

        setFlags(allFlags.length > 0 ? allFlags : []);
      } catch (e) {
        console.warn("Coach athlete view error:", e);
        setFlags([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [athleteId, teamId, isDemoMode]);

  async function assignWorkout() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (!isDemoMode) {
        const { createClient } = await import("@/lib/supabase/client");
        const sb = createClient();
        const { data } = await sb.from("workout_assignments").insert({
          team_id: teamId, assigned_by: coachId, assigned_to: athleteId,
          title: form.title.trim(), workout_type: form.type,
          description: form.notes || null,
          target_date: form.date || null,
        }).select("id, title, workout_type, target_date, completed").single();
        if (data) setAssignments(prev => [data as any, ...prev]);
      } else {
        setAssignments(prev => [{
          id: `demo-${Date.now()}`, title: form.title, workout_type: form.type,
          target_date: form.date || undefined, completed: false,
        }, ...prev]);
      }
      setForm({ title: "", type: "erg", date: "", notes: "" });
      setShowAssign(false);
      toast.success(`Workout assigned to ${athleteName.split(" ")[0]}`);
    } finally {
      setSaving(false);
    }
  }

  const severityIcon = { ok: CheckCircle, warn: AlertTriangle, severe: AlertTriangle };
  const severityColor = { ok: "#10B981", warn: "#F59E0B", severe: "#EF4444" };

  return (
    <div className="mt-5 space-y-4">
      {/* ── Training flags ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">Training Flags</p>
        {loading ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 size={14} className="text-[#0EA5E9] animate-spin" />
            <span className="text-xs text-[#475569]">Analysing sessions…</span>
          </div>
        ) : flags && flags.length > 0 ? (
          <div className="space-y-2">
            {flags.map((f, i) => {
              const Icon = severityIcon[f.severity];
              const color = severityColor[f.severity];
              return (
                <div key={i} className="rounded-xl p-3 border flex gap-2.5" style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}>
                  <Icon size={14} style={{ color }} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold" style={{ color }}>{f.title}</div>
                    <div className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{f.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[#475569] py-2">No sessions to analyse yet.</div>
        )}
      </div>

      {/* ── Assigned workouts ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Assigned Workouts</p>
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="flex items-center gap-1 text-[10px] text-[#0EA5E9] font-semibold"
          >
            <Plus size={10} /> Assign
          </button>
        </div>

        {showAssign && (
          <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-3 mb-2 space-y-2">
            <Input
              placeholder="e.g. 4×500m intervals"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <div className="flex gap-1.5 flex-wrap">
              {(["erg","water","dryland","team","rest"] as WorkoutType[]).map(t => {
                const Icon = WORKOUT_ICONS[t];
                const color = WORKOUT_COLORS[t];
                return (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors capitalize ${
                      form.type === t ? "border-opacity-50" : "border-[#1E293B] text-[#475569]"
                    }`}
                    style={form.type === t ? { borderColor: color, backgroundColor: `${color}20`, color } : {}}
                  >
                    <Icon size={10} />
                    {t}
                  </button>
                );
              })}
            </div>
            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAssign(false)} className="flex-1">Cancel</Button>
              <Button size="sm" disabled={!form.title.trim() || saving} onClick={assignWorkout} className="flex-1">
                {saving ? <Loader2 size={12} className="animate-spin" /> : "Assign"}
              </Button>
            </div>
          </div>
        )}

        {assignments.length === 0 ? (
          <div className="text-xs text-[#334155]">No workouts assigned yet.</div>
        ) : (
          <div className="space-y-1.5">
            {assignments.map(a => {
              const Icon = WORKOUT_ICONS[a.workout_type as WorkoutType] ?? Dumbbell;
              const color = WORKOUT_COLORS[a.workout_type as WorkoutType] ?? "#0EA5E9";
              return (
                <div key={a.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${a.completed ? "border-[#1E293B] opacity-50" : "border-[#1E293B]"}`}>
                  <Icon size={12} style={{ color }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold ${a.completed ? "line-through text-[#475569]" : "text-[#F1F5F9]"}`}>{a.title}</div>
                    {a.target_date && (
                      <div className="flex items-center gap-1 text-[9px] text-[#475569] mt-0.5">
                        <Calendar size={9} />
                        {new Date(a.target_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    )}
                  </div>
                  {a.completed && <Badge variant="success" className="text-[9px]">Done</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
