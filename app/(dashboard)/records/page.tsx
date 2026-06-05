import { Trophy, TrendingUp, Calendar, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockPRs } from "@/lib/data/seed";
import { formatTime, formatDate } from "@/lib/utils";

const ALL_DISTANCES = [200, 250, 500, 1000, 2000];

function PRCard({ category, distance }: { category: "erg" | "water"; distance: number }) {
  const pr = mockPRs.find((p) => p.category === category && p.distance_m === distance);
  const colors = {
    erg: { accent: "#0EA5E9", bg: "#0EA5E9" },
    water: { accent: "#06B6D4", bg: "#06B6D4" },
  };
  const { accent } = colors[category];

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Target size={12} style={{ color: accent }} />
        <span className="text-[10px] font-semibold text-[#64748B] uppercase">
          {category.toUpperCase()} · {distance >= 1000 ? `${distance / 1000}km` : `${distance}m`}
        </span>
      </div>

      {pr ? (
        <>
          <div className="text-2xl font-black text-[#F1F5F9] leading-none">{formatTime(pr.time_sec)}</div>
          <div className="flex items-center gap-2 mt-2">
            {pr.improvement_sec && (
              <div className="flex items-center gap-1">
                <TrendingUp size={11} className="text-[#10B981]" />
                <span className="text-[10px] text-[#10B981] font-bold">−{pr.improvement_sec}s improvement</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-[#475569]">
            <Calendar size={10} />
            <span className="text-[10px]">{formatDate(pr.date)}</span>
          </div>
          {pr.previous_time_sec && (
            <div className="text-[10px] text-[#475569] mt-1">
              Previous: {formatTime(pr.previous_time_sec)}
            </div>
          )}
        </>
      ) : (
        <div className="py-2">
          <div className="text-lg font-bold text-[#475569]">—</div>
          <div className="text-[10px] text-[#475569] mt-1">No PR yet</div>
        </div>
      )}
    </div>
  );
}

export default function RecordsPage() {
  const totalPRs = mockPRs.length;
  const bestImprovement = Math.max(...mockPRs.filter((p) => p.improvement_sec).map((p) => p.improvement_sec!));

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center">
          <Trophy size={20} className="text-[#F59E0B]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">Personal Records</h1>
          <p className="text-xs text-[#64748B]">Your all-time bests</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-3 text-center">
          <div className="text-xl font-black text-[#F59E0B]">{totalPRs}</div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Total PRs</div>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-3 text-center">
          <div className="text-xl font-black text-[#10B981]">−{bestImprovement}s</div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Best Improve</div>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-3 text-center">
          <div className="text-xl font-black text-[#0EA5E9]">2k</div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Top Distance</div>
        </div>
      </div>

      {/* Erg PRs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-[#0EA5E9]" />
          <h2 className="text-sm font-bold text-[#F1F5F9]">Erg (Paddle Erg)</h2>
          <Badge variant="default" className="text-[10px]">5 distances</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ALL_DISTANCES.map((d) => (
            <PRCard key={`erg-${d}`} category="erg" distance={d} />
          ))}
        </div>
      </div>

      {/* Water PRs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-[#06B6D4]" />
          <h2 className="text-sm font-bold text-[#F1F5F9]">Water (Solo Time Trials)</h2>
          <Badge variant="cyan" className="text-[10px]">5 distances</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ALL_DISTANCES.map((d) => (
            <PRCard key={`water-${d}`} category="water" distance={d} />
          ))}
        </div>
      </div>

      {/* Other PRs */}
      <div>
        <h2 className="text-sm font-bold text-[#F1F5F9] mb-3">Other Records</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Longest Paddle", value: "12.4 km", sub: "Jun 2, 2026" },
            { label: "Best Avg Pace", value: "1:56/500m", sub: "May 31, 2026" },
            { label: "Peak Stroke Rate", value: "92 spm", sub: "May 30, 2026" },
            { label: "Best Watts (Erg)", value: "285 W", sub: "May 30, 2026" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
              <div className="text-[10px] text-[#64748B] uppercase font-semibold mb-1">{label}</div>
              <div className="text-xl font-black text-[#F1F5F9]">{value}</div>
              <div className="text-[10px] text-[#475569] mt-1">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Train to Beat */}
      <div className="rounded-2xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Target size={16} className="text-[#0EA5E9]" />
          <h3 className="text-sm font-bold text-[#0EA5E9]">Train to Beat Your 2k PR</h3>
        </div>
        <p className="text-xs text-[#64748B] leading-relaxed mb-3">
          Your current 2k erg PR is {formatTime(512)} ({formatTime(128)}/500m split).
          To beat it, focus on sustaining split consistency across all four 500m segments.
        </p>
        <div className="text-xs text-[#0EA5E9] font-semibold cursor-pointer hover:underline">
          → Start 2k Prep Training Plan
        </div>
      </div>
    </div>
  );
}
