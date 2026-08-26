"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, AlertTriangle, Target, CheckCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/useUser";

// ── Types mirrored from engine (no import to keep server/client boundary clean)
interface RenderedInsight {
  kind: string;
  severity: "ok" | "warn" | "severe";
  title: string;
  body: string;
}
interface CoachData {
  summary: string;
  focusThisWeek: string;
  warnings: RenderedInsight[];
  suggestions: RenderedInsight[];
  positives: RenderedInsight[];
  questionAnswers: Record<string, string>;
}

const QUESTIONS = [
  "Why is my 2nd 500m slower in the 2k?",
  "Am I overtraining?",
  "Which distance am I improving fastest at?",
  "How is my water-to-erg transfer?",
  "What should I focus on this week?",
];

const severityColor = {
  ok: "#10B981",
  warn: "#F59E0B",
  severe: "#EF4444",
} as const;

const severityIcon = {
  ok: CheckCircle,
  warn: AlertTriangle,
  severe: AlertTriangle,
};

// ── Shown when no sessions have been logged ──────────────────────────────────
const EMPTY_OUTPUT: CoachData = {
  summary:
    "No sessions logged yet. Start by logging an erg session or water time trial — your insights will appear here once you have data.",
  focusThisWeek: "Log your first session to get personalised coaching.",
  warnings: [],
  suggestions: [],
  positives: [],
  questionAnswers: Object.fromEntries(
    QUESTIONS.map((q) => [q, "Log at least one session to get a personalised answer to this question."])
  ),
};

export default function AICoachPage() {
  const { userId } = useUser();
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    try {
      // Load sessions from Dexie (offline-safe). This used to return the
      // "no sessions logged yet" placeholder for anyone in demo mode without
      // looking — so on the deployed site the coach told an athlete with ten
      // logged sessions that they had none.
      const { getAllSessionsForUser } = await import("@/lib/db/sessions");
      const { erg, water, dryland, team } = await getAllSessionsForUser(userId);

      // Get PRs from Dexie
      const { getLocalDB } = await import("@/lib/db/schema");
      const db = getLocalDB();
      const localPRs = await db.personalRecords.where("userId").equals(userId).toArray();

      const prs = localPRs.map((p) => ({
        category: p.category as "erg" | "water",
        distance_m: p.distance_m,
        time_sec: p.time_sec,
      }));

      if (erg.length === 0 && water.length === 0) {
        setData(EMPTY_OUTPUT);
        return;
      }

      // Run the deterministic rules engine
      const { runCoachEngine } = await import("@/lib/coach/engine");
      const result = runCoachEngine({
        ergSessions: erg.map((s) => ({
          date: s.date,
          rpe: s.rpe,
          distance_m: s.distance_m,
          duration_sec: s.duration_sec,
          split_sec: s.split_sec,
        })),
        waterSessions: water.map((s) => ({
          date: s.date,
          rpe: s.rpe,
          distance_m: s.distance_m,
          duration_sec: s.duration_sec,
          avg_pace_sec: s.avg_pace_sec,
        })),
        drylandSessions: dryland.map((s) => ({
          date: s.date,
          rpe: s.rpe,
          duration_min: s.duration_min,
        })),
        teamSessions: team.map((s) => ({
          date: s.date,
          rpe: s.rpe ?? 0,
          duration_min: s.duration_min,
        })),
        prs,
      });
      setData(result);
    } catch (err) {
      console.error("Coach engine error:", err);
      setData(EMPTY_OUTPUT);
    } finally {
      setLoading(false);
    }
    // Depends only on identity inputs; everything else it reads is a constant
    // or a setter. Declaring it lets the effect track it honestly instead of
    // silently capturing whichever render defined it.
  }, [userId]);

  // Wrapped rather than called directly: loadInsights runs synchronously up to
  // its first await, so a bare call sets state during the effect and cascades
  // a render.
  useEffect(() => { void (async () => { await loadInsights(); })(); }, [loadInsights]);

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#A855F7]/20 flex items-center justify-center">
          <Brain size={20} className="text-[#A855F7]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-[#F1F5F9]">Coach</h1>
          <p className="text-xs text-[#8A98AC]">Rules-based insights from your own data</p>
        </div>
        <button onClick={() => { setLoading(true); void loadInsights(); }} disabled={loading} className="text-[#7C8AA0] hover:text-[#94A3B8] transition-colors">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
        <Badge variant="secondary" className="text-[10px]">No AI · No API</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-[#8A98AC]">
          <div className="w-6 h-6 rounded-full border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] animate-spin" />
          <span className="text-sm">Computing insights…</span>
        </div>
      ) : data && (
        <>
          {/* Weekly Summary */}
          <div className="rounded-2xl border border-[#A855F7]/30 bg-[#A855F7]/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={15} className="text-[#A855F7]" />
              <h2 className="text-sm font-bold text-[#A855F7]">This Week</h2>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">{data.summary}</p>
          </div>

          {/* Focus This Week */}
          <div className="rounded-2xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Target size={14} className="text-[#0EA5E9]" />
              <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wide">Focus This Week</span>
            </div>
            <p className="text-sm text-[#94A3B8]">{data.focusThisWeek}</p>
          </div>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider">Watch Out</h2>
              {data.warnings.map((w, i) => (
                <InsightCard key={i} insight={w} expanded={expanded === `w${i}`} onToggle={() => setExpanded(expanded === `w${i}` ? null : `w${i}`)} />
              ))}
            </div>
          )}

          {/* Suggestions */}
          {data.suggestions.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider">Suggestions</h2>
              {data.suggestions.map((s, i) => (
                <InsightCard key={i} insight={s} expanded={expanded === `s${i}`} onToggle={() => setExpanded(expanded === `s${i}` ? null : `s${i}`)} />
              ))}
            </div>
          )}

          {/* Positives */}
          {data.positives.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider">Going Well</h2>
              {data.positives.map((p, i) => (
                <InsightCard key={i} insight={p} expanded={expanded === `p${i}`} onToggle={() => setExpanded(expanded === `p${i}` ? null : `p${i}`)} />
              ))}
            </div>
          )}

          {/* Questions Panel */}
          <div>
            <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Ask Your Data</h2>
            <div className="flex flex-col gap-2">
              {QUESTIONS.map((q) => (
                <div key={q}>
                  <button
                    onClick={() => setActiveQ(activeQ === q ? null : q)}
                    className={`w-full text-left text-sm rounded-xl border px-4 py-3 transition-colors cursor-pointer ${
                      activeQ === q
                        ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]"
                        : "border-[#1E293B] bg-[#0D1528] text-[#94A3B8] hover:border-[#334155]"
                    }`}
                  >
                    {q}
                  </button>
                  {activeQ === q && (
                    <div className="mt-1 rounded-xl bg-[#1E293B] px-4 py-3 text-sm text-[#94A3B8] leading-relaxed whitespace-pre-wrap">
                      {data.questionAnswers[q] ?? "No data available."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Engine note */}
          <div className="rounded-xl border border-[#1E293B] p-4 text-center">
            <p className="text-xs text-[#7C8AA0]">
              All insights are computed by a <span className="text-[#94A3B8] font-semibold">deterministic rules engine</span> running entirely on your device from your logged sessions.
              No AI API, no external calls, zero recurring cost.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function InsightCard({
  insight,
  expanded,
  onToggle,
}: {
  insight: RenderedInsight;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = severityIcon[insight.severity];
  const color = severityColor[insight.severity];

  return (
    <div
      className={`rounded-2xl border p-4 cursor-pointer transition-colors ${
        expanded ? "border-[#334155] bg-[#111827]" : "border-[#1E293B] bg-[#0D1528] hover:border-[#334155]"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Icon size={16} style={{ color, marginTop: 2 }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F1F5F9] leading-snug">{insight.title}</p>
          {expanded && (
            <p className="text-xs text-[#94A3B8] leading-relaxed mt-2">{insight.body}</p>
          )}
        </div>
        <span className="text-[#7C8AA0] text-xs">{expanded ? "▲" : "▼"}</span>
      </div>
    </div>
  );
}
