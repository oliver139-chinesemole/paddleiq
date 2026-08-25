"use client";

import { Info, ArrowLeft, ArrowRight } from "lucide-react";
import {
  syncVerdict,
  SYNC_VERDICT_COPY,
  worstOffenders,
  type TeamSyncResult,
  type SyncVerdict,
} from "@/lib/pose/sync";

const VERDICT_STYLES: Record<SyncVerdict, { text: string; chip: string; bar: string }> = {
  "locked-in": { text: "text-[#4ADE80]", chip: "bg-[#22C55E]/15 text-[#4ADE80]", bar: "bg-[#22C55E]" },
  close: { text: "text-[#4ADE80]", chip: "bg-[#22C55E]/15 text-[#4ADE80]", bar: "bg-[#22C55E]" },
  loose: { text: "text-[#FBBF24]", chip: "bg-[#F59E0B]/15 text-[#FBBF24]", bar: "bg-[#F59E0B]" },
  scattered: { text: "text-[#F87171]", chip: "bg-[#EF4444]/15 text-[#F87171]", bar: "bg-[#EF4444]" },
};

/** Colours a single seat by how far off it is, independent of the crew verdict. */
function seatColor(offsetMs: number) {
  const a = Math.abs(offsetMs);
  if (a <= 25) return "bg-[#22C55E]";
  if (a <= 60) return "bg-[#F59E0B]";
  return "bg-[#EF4444]";
}

export function TeamSyncResults({
  result,
  onRetake,
  onDone,
}: {
  result: TeamSyncResult;
  onRetake?: () => void;
  onDone?: () => void;
}) {
  const verdict = syncVerdict(result.spreadMs);
  const style = VERDICT_STYLES[verdict];
  const copy = SYNC_VERDICT_COPY[verdict];
  const offenders = worstOffenders(result, 2).filter((s) => Math.abs(s.offsetMs) > 25);

  // Scale bars against the largest offset so small spreads stay readable.
  const maxAbs = Math.max(40, ...result.seats.map((s) => Math.abs(s.offsetMs)));

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Headline */}
      <div className="bg-gradient-to-br from-[#0EA5E9]/20 to-[#0F172A] border border-[#1E293B] rounded-3xl p-6 text-center">
        <div className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase">
          Crew timing spread
        </div>
        <div className={`text-6xl font-bold mt-2 ${style.text}`}>
          {Math.round(result.spreadMs)}
          <span className="text-2xl font-semibold ml-1">ms</span>
        </div>
        <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-lg mt-3 ${style.chip}`}>
          {copy.label}
        </span>
        <p className="text-[#94A3B8] text-sm mt-3 leading-relaxed">{copy.body}</p>
        <div className="text-[#475569] text-xs mt-3">
          {result.seats.length} paddlers · {result.pairedStrokes} strokes ·{" "}
          {Math.round(result.strokeRateSpm)} spm
        </div>
      </div>

      {/* Per-seat offsets */}
      <div>
        <h3 className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase mb-1">
          Who&apos;s early, who&apos;s late
        </h3>
        <div className="flex items-center justify-between text-[10px] text-[#475569] mb-3">
          <span className="flex items-center gap-1"><ArrowLeft size={11} /> early</span>
          <span>on the crew</span>
          <span className="flex items-center gap-1">late <ArrowRight size={11} /></span>
        </div>

        <div className="flex flex-col gap-3">
          {result.seats.map((s) => {
            const pct = (Math.abs(s.offsetMs) / maxAbs) * 50; // half-width max
            const late = s.offsetMs > 0;
            return (
              <div key={s.seat} className="bg-[#111C2E] border border-[#1E293B] rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-bold text-sm">Position {s.seat + 1}</span>
                  <span className="text-sm font-bold tabular-nums text-[#CBD5E1]">
                    {s.offsetMs > 0 ? "+" : ""}
                    {Math.round(s.offsetMs)}ms
                  </span>
                </div>

                {/* Centre line with the bar growing left or right of it */}
                <div className="relative h-3 bg-[#0B1220] rounded-full overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#334155]" />
                  <div
                    className={`absolute top-0 bottom-0 ${seatColor(s.offsetMs)} rounded-full`}
                    style={{
                      left: late ? "50%" : `${50 - pct}%`,
                      width: `${Math.max(pct, 1)}%`,
                    }}
                  />
                </div>

                <div className="text-[#475569] text-[11px] mt-1.5">
                  {s.strokeCount} strokes · ±{Math.round(s.offsetSpreadMs)}ms variation
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What to do about it */}
      {offenders.length > 0 && (
        <div className="bg-[#111C2E] border border-[#1E293B] rounded-2xl p-4">
          <div className="text-[#64748B] text-[10px] font-bold tracking-wide uppercase mb-2">
            Where to look first
          </div>
          <ul className="flex flex-col gap-2">
            {offenders.map((s) => (
              <li key={s.seat} className="text-[#CBD5E1] text-sm leading-relaxed">
                <span className="font-bold text-white">Position {s.seat + 1}</span> is catching{" "}
                {Math.abs(Math.round(s.offsetMs))}ms {s.offsetMs > 0 ? "after" : "before"} the crew
                {s.offsetSpreadMs > 60
                  ? " and their timing wanders a lot, so start with rhythm before position."
                  : " consistently, which is the easy kind to fix — they just need a new reference point."}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 bg-[#0B1220] border border-[#1E293B] rounded-2xl p-4">
        <Info size={16} className="text-[#64748B] shrink-0 mt-0.5" />
        <p className="text-[#64748B] text-xs leading-relaxed">
          Positions are numbered left to right <span className="text-[#94A3B8]">as the camera
          sees them</span>, not by seat number in the boat. Offsets are measured against the crew&apos;s
          own average catch, so this shows who is out of step with everyone else — it can&apos;t tell
          you the whole boat is behind the drum. Sampling runs at 20Hz, so treat differences under
          about 25ms as noise.
        </p>
      </div>

      <div className="flex gap-3">
        {onRetake && (
          <button
            onClick={onRetake}
            className="flex-1 bg-[#1E293B] hover:bg-[#334155] text-white font-bold py-4 rounded-2xl transition-colors"
          >
            Analyze another
          </button>
        )}
        {onDone && (
          <button
            onClick={onDone}
            className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold py-4 rounded-2xl transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
