"use client";

import Link from "next/link";
import { ChevronRight, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { buildFindings, overallScore, SEVERITY_LABEL, type Severity } from "@/lib/pose/feedback";
import type { StrokeMetrics } from "@/lib/pose/analyze";
import type { FormCheckResult } from "@/lib/pose/history";

const SEVERITY_STYLES: Record<Severity, { dot: string; chip: string; text: string }> = {
  good: { dot: "bg-[#22C55E]", chip: "bg-[#22C55E]/15 text-[#4ADE80]", text: "text-[#4ADE80]" },
  watch: { dot: "bg-[#F59E0B]", chip: "bg-[#F59E0B]/15 text-[#FBBF24]", text: "text-[#FBBF24]" },
  "work-on": { dot: "bg-[#EF4444]", chip: "bg-[#EF4444]/15 text-[#F87171]", text: "text-[#F87171]" },
};

function scoreColor(score: number) {
  if (score >= 80) return "text-[#4ADE80]";
  if (score >= 55) return "text-[#FBBF24]";
  return "text-[#F87171]";
}

function Delta({ now, before, lowerIsBetter = false }: { now: number; before?: number; lowerIsBetter?: boolean }) {
  if (before === undefined || !Number.isFinite(before)) return null;
  const diff = now - before;
  if (Math.abs(diff) < 0.005) {
    return (
      <span className="flex items-center gap-0.5 text-[#8A98AC] text-xs">
        <Minus size={12} /> same
      </span>
    );
  }
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${better ? "text-[#4ADE80]" : "text-[#F87171]"}`}>
      <Icon size={12} />
      {diff > 0 ? "+" : ""}
      {diff.toFixed(2)}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111C2E] border border-[#1E293B] rounded-2xl p-4">
      <div className="text-[#8A98AC] text-[11px] font-semibold tracking-wide uppercase">{label}</div>
      <div className="text-white text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[#7C8AA0] text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export function FormCheckResults({
  metrics,
  previous,
  onDone,
  onRetake,
}: {
  metrics: StrokeMetrics;
  previous?: FormCheckResult | null;
  onDone?: () => void;
  onRetake?: () => void;
}) {
  const findings = buildFindings(metrics);
  const score = overallScore(findings);
  const prev = previous?.metrics;

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Score */}
      <div className="bg-gradient-to-br from-[#0EA5E9]/20 to-[#0F172A] border border-[#1E293B] rounded-3xl p-6 text-center">
        <div className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase">Technique score</div>
        <div className={`text-6xl font-bold mt-2 ${scoreColor(score)}`}>{score}</div>
        <div className="text-[#8A98AC] text-sm mt-2">
          from {metrics.strokeCount} strokes at {Math.round(metrics.strokeRateSpm)} spm
        </div>
        {previous && (
          <div className="text-[#7C8AA0] text-xs mt-1">
            Last check: {previous.score} on {previous.date}
          </div>
        )}
      </div>

      {/* Raw measurements */}
      <div>
        <h3 className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase mb-3">Measurements</h3>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Stroke rate" value={`${Math.round(metrics.strokeRateSpm)}`} sub="strokes / min" />
          <Stat label="Strokes read" value={`${metrics.strokeCount}`} sub={`${Math.round(metrics.poseQuality * 100)}% tracked`} />
          <Stat label="Reach" value={metrics.reach.toFixed(2)} sub="torso units" />
          <Stat label="Stroke length" value={metrics.strokeLength.toFixed(2)} sub="torso units" />
          <Stat label="Timing spread" value={`${metrics.timingVariationPct.toFixed(1)}%`} sub="lower is tighter" />
          <Stat
            label="Rotation"
            value={metrics.rotationRange !== null ? metrics.rotationRange.toFixed(2) : "—"}
            sub={metrics.rotationRange !== null ? "catch to exit" : "shoulders not visible"}
          />
        </div>
      </div>

      {/* Findings */}
      <div>
        <h3 className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase mb-3">
          What to work on
        </h3>
        <div className="flex flex-col gap-3">
          {findings.map((f) => {
            const s = SEVERITY_STYLES[f.severity];
            const prevValue =
              prev && f.id === "timing"
                ? prev.timingVariationPct
                : prev && f.id === "reach"
                  ? prev.reach
                  : prev && f.id === "length"
                    ? prev.strokeLength
                    : prev && f.id === "rotation" && prev.rotationRange !== null
                      ? prev.rotationRange
                      : undefined;

            return (
              <div key={f.id} className="bg-[#111C2E] border border-[#1E293B] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-white font-bold truncate">{f.title}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${s.chip}`}>
                    {SEVERITY_LABEL[f.severity]}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-lg font-bold ${s.text}`}>{f.value}</span>
                  <Delta
                    now={
                      f.id === "timing"
                        ? metrics.timingVariationPct
                        : f.id === "reach"
                          ? metrics.reach
                          : f.id === "length"
                            ? metrics.strokeLength
                            : f.id === "rotation"
                              ? (metrics.rotationRange ?? 0)
                              : 0
                    }
                    before={prevValue}
                    lowerIsBetter={f.id === "timing" || f.id === "consistency"}
                  />
                </div>

                <p className="text-[#94A3B8] text-sm mt-2 leading-relaxed">{f.message}</p>

                <div className="mt-3 bg-[#0B1220] border border-[#1E293B] rounded-xl p-3">
                  <div className="text-[#8A98AC] text-[10px] font-bold tracking-wide uppercase mb-1">
                    Try this
                  </div>
                  <p className="text-[#CBD5E1] text-sm">{f.drill}</p>
                </div>

                <Link
                  href={`/technique?lesson=${f.lessonId}`}
                  className="flex items-center justify-between mt-3 text-[#0EA5E9] text-sm font-semibold"
                >
                  Read: {f.lessonTitle}
                  <ChevronRight size={16} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Honesty about what this can and can't see */}
      <div className="flex gap-3 bg-[#0B1220] border border-[#1E293B] rounded-2xl p-4">
        <Info size={16} className="text-[#8A98AC] shrink-0 mt-0.5" />
        <p className="text-[#8A98AC] text-xs leading-relaxed">
          These numbers come from tracking your body in a single 2D video, so they describe your
          strokes <span className="text-[#94A3B8]">relative to each other</span> — they are not
          absolute biomechanical measurements. The paddle itself isn&apos;t tracked, so blade angle
          and catch depth aren&apos;t included. Film from the same side and distance each time for
          comparable results, and treat this as a prompt for your coach rather than a replacement.
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
