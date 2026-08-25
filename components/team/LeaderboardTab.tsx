"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { formatTime, formatDistance } from "@/lib/utils";

type Category = "erg500" | "erg2k" | "weekly_dist" | "attendance" | "most_improved";
type Period  = "all" | "30d" | "7d";

type LbRow = { user_id: string; name: string; value: number; subLabel?: string };

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO: Record<Category, LbRow[]> = {
  erg500:       [
    { user_id: "m3", name: "Sam Rivera",    value: 117 },
    { user_id: "m1", name: "Alex Chen",     value: 118 },
    { user_id: "m5", name: "Morgan Liu",    value: 120 },
    { user_id: "m2", name: "Jordan Kim",    value: 121 },
    { user_id: "m4", name: "Taylor Nguyen", value: 125 },
  ],
  erg2k:        [
    { user_id: "m3", name: "Sam Rivera",    value: 472 },
    { user_id: "m1", name: "Alex Chen",     value: 480 },
    { user_id: "m5", name: "Morgan Liu",    value: 488 },
    { user_id: "m2", name: "Jordan Kim",    value: 492 },
    { user_id: "m4", name: "Taylor Nguyen", value: 510 },
  ],
  weekly_dist:  [
    { user_id: "m1", name: "Alex Chen",     value: 12400, subLabel: "12.4 km" },
    { user_id: "m3", name: "Sam Rivera",    value: 11200, subLabel: "11.2 km" },
    { user_id: "m5", name: "Morgan Liu",    value: 9600,  subLabel: "9.6 km" },
    { user_id: "m2", name: "Jordan Kim",    value: 8800,  subLabel: "8.8 km" },
    { user_id: "m4", name: "Taylor Nguyen", value: 7200,  subLabel: "7.2 km" },
  ],
  attendance:   [
    { user_id: "m3", name: "Sam Rivera",    value: 100, subLabel: "3/3 events" },
    { user_id: "m1", name: "Alex Chen",     value: 100, subLabel: "3/3 events" },
    { user_id: "m5", name: "Morgan Liu",    value:  67, subLabel: "2/3 events" },
    { user_id: "m2", name: "Jordan Kim",    value:  67, subLabel: "2/3 events" },
    { user_id: "m4", name: "Taylor Nguyen", value:  33, subLabel: "1/3 events" },
  ],
  most_improved:[
    { user_id: "m1", name: "Alex Chen",     value: 10, subLabel: "−10s on 2k" },
    { user_id: "m3", name: "Sam Rivera",    value:  7, subLabel: "−7s on 500m" },
    { user_id: "m5", name: "Morgan Liu",    value:  4, subLabel: "−4s on 500m" },
    { user_id: "m2", name: "Jordan Kim",    value:  2, subLabel: "−2s on 2k" },
    { user_id: "m4", name: "Taylor Nguyen", value:  0, subLabel: "No change" },
  ],
};

const CATEGORY_LABEL: Record<Category, string> = {
  erg500:       "500m Erg",
  erg2k:        "2k Erg",
  weekly_dist:  "Weekly Dist.",
  attendance:   "Attendance",
  most_improved:"Most Improved",
};

const PERIOD_LABEL: Record<Period, string> = { all: "All time", "30d": "30 days", "7d": "7 days" };

// Lower = better (time-based); higher = better (others)
const LOWER_IS_BETTER: Record<Category, boolean> = {
  erg500: true, erg2k: true, weekly_dist: false, attendance: false, most_improved: false,
};

function formatValue(cat: Category, val: number) {
  if (cat === "erg500" || cat === "erg2k") return formatTime(val);
  if (cat === "weekly_dist") return `${(val / 1000).toFixed(1)} km`;
  if (cat === "attendance") return `${Math.round(val)}%`;
  return `−${val}s`;
}

function medal(i: number) {
  return i === 0 ? "bg-[#F59E0B] text-[#0A0F1E]"
       : i === 1 ? "bg-[#94A3B8] text-[#0A0F1E]"
       : i === 2 ? "bg-[#CD7C2B] text-[#0A0F1E]"
       : "bg-[#1E293B] text-[#64748B]";
}

// ── LeaderboardTab ────────────────────────────────────────────────────────────
export default function LeaderboardTab({
  teamId, userId: _userId, isDemoMode, memberIds, memberNames,
}: {
  teamId: string;
  userId: string;
  isDemoMode: boolean;
  memberIds: string[];
  memberNames: Record<string, string>;
}) {
  const [cat, setCat] = useState<Category>("erg500");
  const [period, setPeriod] = useState<Period>("all");
  const [rows, setRows] = useState<LbRow[]>(() => isDemoMode ? DEMO[cat] : []);
  const [loading, setLoading] = useState(!isDemoMode);

  const load = useCallback(async () => {
    if (isDemoMode) return;
    if (memberIds.length === 0) {
      await Promise.resolve();
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();

      const cutoff = period === "7d"  ? new Date(Date.now() - 7  * 86400000).toISOString().split("T")[0]
                   : period === "30d" ? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
                   : "2000-01-01";

      if (cat === "erg500" || cat === "erg2k") {
        const distM = cat === "erg500" ? 500 : 2000;
        const { data } = await sb
          .from("personal_records")
          .select("user_id, time_sec")
          .in("user_id", memberIds)
          .eq("category", "erg")
          .eq("distance_m", distM)
          .order("time_sec", { ascending: true });
        type PRRow = { user_id: string; time_sec: number };
        setRows(((data ?? []) as PRRow[]).map((r: PRRow) => ({ user_id: r.user_id, name: memberNames[r.user_id] ?? "Athlete", value: r.time_sec })));
        return;
      }

      if (cat === "weekly_dist") {
        const { data } = await sb
          .from("erg_sessions")
          .select("user_id, distance_m")
          .in("user_id", memberIds)
          .gte("date", cutoff);
        type DistRow = { user_id: string; distance_m: number };
        const totals: Record<string, number> = {};
        ((data ?? []) as DistRow[]).forEach((r: DistRow) => { totals[r.user_id] = (totals[r.user_id] ?? 0) + r.distance_m; });
        const result = Object.entries(totals)
          .map(([uid, dist]) => ({ user_id: uid, name: memberNames[uid] ?? "Athlete", value: dist, subLabel: `${(dist / 1000).toFixed(1)} km` }))
          .sort((a, b) => b.value - a.value);
        setRows(result);
        return;
      }

      if (cat === "attendance") {
        // Count RSVP "yes" per user across team events
        const { data: events } = await sb.from("team_events").select("id").eq("team_id", teamId).gte("event_date", cutoff);
        type EventRow = { id: string };
        type RsvpRow = { user_id: string; status: string };
        const eventIds = ((events ?? []) as EventRow[]).map((e: EventRow) => e.id);
        if (eventIds.length === 0) { setRows([]); return; }
        const { data: rsvps } = await sb.from("event_rsvp").select("user_id, status").in("event_id", eventIds).in("user_id", memberIds);
        const yes: Record<string, number> = {};
        const total = eventIds.length;
        ((rsvps ?? []) as RsvpRow[]).forEach((r: RsvpRow) => { if (r.status === "yes") yes[r.user_id] = (yes[r.user_id] ?? 0) + 1; });
        const result = memberIds
          .map(uid => ({ user_id: uid, name: memberNames[uid] ?? "Athlete", value: Math.round(((yes[uid] ?? 0) / total) * 100), subLabel: `${yes[uid] ?? 0}/${total} events` }))
          .sort((a, b) => b.value - a.value);
        setRows(result);
        return;
      }

      if (cat === "most_improved") {
        // Compare earliest vs latest PR at same distance (500m erg)
        const { data } = await sb
          .from("personal_records")
          .select("user_id, distance_m, time_sec, previous_time_sec, improvement_sec")
          .in("user_id", memberIds)
          .eq("category", "erg")
          .not("improvement_sec", "is", null)
          .order("improvement_sec", { ascending: false });
        // Best improvement per user
        const best: Record<string, { improvement_sec: number; distance_m: number }> = {};
        type ImprovRow = { user_id: string; improvement_sec: number; distance_m: number };
        ((data ?? []) as ImprovRow[]).forEach((r: ImprovRow) => {
          if (!best[r.user_id] || r.improvement_sec > best[r.user_id].improvement_sec) {
            best[r.user_id] = { improvement_sec: r.improvement_sec, distance_m: r.distance_m };
          }
        });
        const result = Object.entries(best)
          .map(([uid, { improvement_sec, distance_m }]) => ({
            user_id: uid, name: memberNames[uid] ?? "Athlete", value: improvement_sec,
            subLabel: `−${improvement_sec}s on ${distance_m >= 1000 ? `${distance_m / 1000}k` : `${distance_m}m`}`,
          }))
          .sort((a, b) => b.value - a.value);
        setRows(result);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [cat, period, isDemoMode, memberIds, memberNames, teamId]);

  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  const lowerIsBetter = LOWER_IS_BETTER[cat];

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              cat === c ? "border-[#0EA5E9]/50 bg-[#0EA5E9]/15 text-[#0EA5E9]" : "border-[#1E293B] text-[#475569] hover:border-[#334155]"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* Time period filter */}
      <div className="flex gap-1">
        {(["all","30d","7d"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              period === p ? "border-[#334155] bg-[#1E293B] text-[#F1F5F9]" : "border-[#1E293B] text-[#475569]"
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy size={14} className="text-[#F59E0B]" />
        <span className="text-xs font-bold text-[#F1F5F9]">
          {CATEGORY_LABEL[cat]} — {lowerIsBetter ? "Fastest" : "Highest"}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-[#0EA5E9] animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#475569] text-center py-6">No data yet for this category.</p>
      ) : (
        rows.map((row, i) => (
          <div
            key={row.user_id}
            className={`flex items-center gap-4 rounded-xl border p-4 ${
              i === 0 ? "border-[#F59E0B]/30 bg-[#F59E0B]/10" : "border-[#1E293B] bg-[#0D1528]"
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${medal(i)}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#F1F5F9] truncate">{row.name}</div>
              {row.subLabel && <div className="text-[10px] text-[#64748B] mt-0.5">{row.subLabel}</div>}
            </div>
            <div className="text-right shrink-0">
              <div className={`text-base font-black ${i === 0 ? "text-[#F59E0B]" : "text-[#F1F5F9]"}`}>
                {formatValue(cat, row.value)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
