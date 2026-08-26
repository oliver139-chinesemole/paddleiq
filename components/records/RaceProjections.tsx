"use client";

import { Activity, Info } from "lucide-react";
import { formatTime } from "@/lib/utils";
import {
  fitEnduranceProfile,
  findProfileGaps,
  DEFAULT_EXPONENT,
  MEANINGFUL_GAP_PCT,
  type RacePoint,
} from "@/lib/predict/race";

const LEAN_COPY = {
  endurance: {
    label: "Endurance-leaning",
    accent: "#10B981",
    blurb:
      "You hold pace better than average as the distance grows. Your ceiling is most likely limited by top-end speed, not by staying power.",
    focus: "Short, sharp work — race-pace 200s and 250s — will move your times more than another long steady session.",
  },
  speed: {
    label: "Speed-leaning",
    accent: "#F59E0B",
    blurb:
      "You are quick over short distances but fade more than average as they get longer. That is an aerobic ceiling, not a technique fault.",
    focus: "Volume at conversational effort is the lever here. It is the least exciting training and the one most likely to work.",
  },
  balanced: {
    label: "Balanced",
    accent: "#0EA5E9",
    blurb:
      "Your times across distances fall close to the typical curve — no obvious lopsidedness between speed and endurance.",
    focus: "Nothing stands out as a weak link, so train for the distance you actually race.",
  },
} as const;

function distanceLabel(m: number) {
  return m >= 1000 ? `${m / 1000}km` : `${m}m`;
}

/**
 * What the athlete's PRs say about the shape of their fitness, and which
 * distance is out of line with the rest.
 *
 * This is deliberately separate from the projected times on the cards above:
 * a projection is a number to chase, while this is the thing the numbers
 * together imply about what to train. Only shown once there are enough PRs to
 * say something real — with fewer, it would be dressing up a guess.
 */
export function RaceProjections({ prs }: { prs: RacePoint[] }) {
  const profile = fitEnduranceProfile(prs);
  const gaps = findProfileGaps(prs);
  const weakest = gaps.find((g) => g.delta_pct > MEANINGFUL_GAP_PCT);

  // Without a fitted exponent there is nothing here that isn't just the
  // generic curve restated, so say what's missing instead of filling space.
  if (!profile.fitted) {
    const distinct = new Set(prs.filter((p) => p.time_sec > 0).map((p) => p.distance_m)).size;
    return (
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={16} className="text-[#8A98AC]" />
          <h3 className="text-sm font-bold text-[#F1F5F9]">Your Endurance Profile</h3>
        </div>
        <p className="text-xs text-[#8A98AC] leading-relaxed">
          {distinct < 3
            ? `Time trials at ${3 - distinct} more ${distinct === 2 ? "distance" : "distances"} and this
               will show whether you lean toward speed or endurance, and which distance is
               holding you back.`
            : `Your PRs don't yet fall on a consistent curve, so a profile fitted to them
               would be reading noise. Another time trial or two should settle it.`}
        </p>
      </div>
    );
  }

  const copy = LEAN_COPY[profile.lean];

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: `${copy.accent}33`, backgroundColor: `${copy.accent}0D` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} style={{ color: copy.accent }} />
        <h3 className="text-sm font-bold" style={{ color: copy.accent }}>
          Your Endurance Profile
        </h3>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-black text-[#F1F5F9]">{copy.label}</span>
      </div>

      <p className="text-xs text-[#8A98AC] leading-relaxed">{copy.blurb}</p>
      <p className="text-xs text-[#C3CEDC] leading-relaxed mt-2">{copy.focus}</p>

      {weakest && (
        <div className="mt-4 pt-4 border-t border-[#1E293B]">
          <div className="text-[10px] uppercase font-semibold text-[#8A98AC] mb-1">
            Furthest off your own curve
          </div>
          <p className="text-xs text-[#C3CEDC] leading-relaxed">
            Your {distanceLabel(weakest.distance_m)} is{" "}
            <span className="font-bold text-[#F1F5F9]">{Math.abs(weakest.delta_sec)}s slower</span>{" "}
            than your other PRs predict ({formatTime(weakest.expected_sec)} vs{" "}
            {formatTime(weakest.actual_sec)}). That is often just an old PR rather than a real
            weakness — worth re-testing before you train for it.
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#1E293B] flex gap-2">
        <Info size={12} className="text-[#7C8AA0] shrink-0 mt-0.5" />
        <p className="text-[10px] text-[#7C8AA0] leading-relaxed">
          Fitted to {profile.points} PRs using Riegel&apos;s formula. Your fade rate is{" "}
          {profile.exponent.toFixed(3)} against a typical {DEFAULT_EXPONENT} — lower means you
          hold pace better over distance. Race results depend on conditions, pacing and the day;
          treat this as a direction, not a verdict.
        </p>
      </div>
    </div>
  );
}
