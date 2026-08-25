/**
 * Deterministic plain-language strings, templated from computed values.
 * No model, no external API. Every string here is statically verified.
 */

import { formatTime } from "@/lib/utils";
import type {
  CoachInsight, } from "./types";

function distLabel(m: number): string {
  return m >= 1000 ? `${m / 1000}k` : `${m}m`;
}

// ── Per-insight short description ─────────────────────────────────────────────
export function insightTitle(i: CoachInsight): string {
  switch (i.kind) {
    case "split-fade": return `2k split fades ${i.fadeSec.toFixed(1)}s in the ${i.fadingSegment}`;
    case "pacing-consistency": return `Split variance ±${i.stdDevSec}s/500m across ${i.sampleCount} sessions`;
    case "training-load":
      // Until there's a chronic base, the ratio is arithmetic rather than
      // signal, so it must not be reported as a spike or a shortfall.
      if (!i.sufficientHistory) return `Building your training baseline (${i.historyDays} days logged)`;
      if (i.acwr > 1.3) return `Training spike: ACWR ${i.acwr} (above 1.3 safe ceiling)`;
      if (i.acwr < 0.8) return `Undertraining detected: ACWR ${i.acwr} (below 0.8)`;
      return `Training load healthy: ACWR ${i.acwr}`;
    case "high-rpe-streak": return `${i.streakLength} consecutive high-RPE sessions (avg ${i.avgRpe})`;
    case "modality-gap":
      if (i.modality === "dryland") return i.daysSinceLastSession < 999
        ? `No dryland training in ${i.daysSinceLastSession} days`
        : "No dryland sessions logged yet";
      return i.daysSinceLastSession < 999
        ? `No water session in ${i.daysSinceLastSession} days`
        : "No water sessions logged yet";
    case "boat-erg-gap": return `Water 500m is ${i.gapSec.toFixed(0)}s slower than erg (${(i.efficiency).toFixed(0)}% transfer efficiency)`;
    case "pr-proximity": return i.gapSec <= 0
      ? `New ${i.category} ${distLabel(i.distanceM)} PR! Beat old best by ${Math.abs(i.gapSec).toFixed(1)}s`
      : `Within ${i.gapSec.toFixed(1)}s of your ${i.category} ${distLabel(i.distanceM)} PR`;
    case "pr-trend": return i.improvementSec > 0
      ? `Improving ${distLabel(i.distanceM)} erg split: ${i.improvementSec}s faster over ${i.sessions} sessions`
      : `${distLabel(i.distanceM)} erg split has plateaued across ${i.sessions} sessions`;
  }
}

// ── Per-insight one-paragraph explanation ─────────────────────────────────────
export function insightBody(i: CoachInsight): string {
  switch (i.kind) {
    case "split-fade":
      return `Your ${i.fadingSegment} segment runs ${i.fadeSec.toFixed(1)}s per 500m slower than your opening pace. This is the most common pattern in 2k races — anaerobic reserves deplete around 800–1200m. Fix: add pacing interval work where the first half is deliberately 4–5s/500m slower than max. Your goal is a flat or negative split.`;
    case "pacing-consistency":
      return `Your splits have a standard deviation of ±${i.stdDevSec}s/500m. ${i.stdDevSec >= 8 ? "This is high — your effort varies a lot session to session, which makes it hard to track real improvement." : "This is moderate — consistent pacing will help you know your true capability."} Try 4–5 steady-state pieces at the same target split without looking at the display.`;
    case "training-load":
      if (!i.sufficientHistory) return `You've logged ${i.historyDays} days so far. Training load is judged by comparing this week against a four-week baseline, so there isn't enough history yet to tell a hard week from a normal one. Keep logging — the reading becomes meaningful after about three weeks.`;
      if (i.acwr > THRESHOLDS_INLINE.acwrHigh) return `Your 7-day training load (${i.weeklyLoadSRPE} sRPE) is ${Math.round(i.acwr * 100 - 100)}% above your 4-week baseline. This places you in the overreaching zone. Add 1–2 easy technique sessions or complete rest days before increasing intensity again.`;
      if (i.acwr < THRESHOLDS_INLINE.acwrLow) return `Your recent training volume (${i.weeklyLoadSRPE} sRPE this week vs ${i.monthlyAvgSRPE} average) is below your baseline. This may indicate undertraining — consider adding one more session this week at low intensity to maintain adaptation.`;
      return `Your training load is in the optimal zone (ACWR ${i.acwr}). Continue at this volume and intensity.`;
    case "high-rpe-streak":
      return `You've logged ${i.streakLength} sessions in a row at RPE ${THRESHOLDS_INLINE.highRpeMinimum}+. Sustained high-RPE training without recovery degrades performance and raises injury risk. Insert a low-intensity technique session (RPE 4–5) before your next hard piece.`;
    case "modality-gap":
      if (i.modality === "dryland") return `Dryland strength underpins water performance — lats, rotators, and core work directly transfer to stroke power. ${i.daysSinceLastSession < 999 ? `It's been ${i.daysSinceLastSession} days since your last gym session.` : "Log your first dryland session to track strength progress."} Aim for 2× per week during off-water periods.`;
      return `On-water feel is hard to replace with erg work alone. ${i.daysSinceLastSession < 999 ? `It's been ${i.daysSinceLastSession} days since your last water session.` : "Log your first water session to track on-water performance."} Getting in a boat at least every ${THRESHOLDS_INLINE.waterGapDays} days keeps timing and balance sharp.`;
    case "boat-erg-gap":
      return `Your best 500m water pace is ${i.gapSec.toFixed(0)}s/500m slower than your best erg split. A gap of 10–20s is normal (erg measures pure power; water adds equipment, conditions, and technique variability). A gap above 25s suggests technique losses on the water. Focus on catch timing and stroke rate consistency in your next water session.`;
    case "pr-proximity":
      return i.gapSec <= 0
        ? `Outstanding — you've beaten your previous ${i.category} ${distLabel(i.distanceM)} best of ${formatTime(i.prTimeSec)} with a ${formatTime(i.recentTimeSec)}. Log a formal PR test if this was done in a controlled setting.`
        : `A recent session came within ${i.gapSec.toFixed(1)}s of your ${i.category} ${distLabel(i.distanceM)} PR (${formatTime(i.prTimeSec)}). A full PR attempt may be ready — try a rested 100% effort after a light day.`;
    case "pr-trend":
      return i.improvementSec > 0
        ? `Your ${distLabel(i.distanceM)} erg split has improved by an average of ${i.improvementSec}s over ${i.sessions} sessions. The work is showing — keep the training structure the same and continue testing regularly.`
        : `Your ${distLabel(i.distanceM)} erg performance has plateaued. Consider varying stimulus: try a different distance, change interval structure, or add a deload week to let adaptation catch up.`;
  }
}

// Inline copy of thresholds to avoid circular import in templates
const THRESHOLDS_INLINE = { acwrHigh: 1.3, acwrLow: 0.8, highRpeMinimum: 8, waterGapDays: 14 };

// ── Weekly summary (synthesised plain-language string) ────────────────────────
export function buildWeeklySummary(
  ergTrend: { improvementSec: number; sessions: number; distance: number } | null,
  load: { acwr: number; weeklyLoadSRPE: number; sufficientHistory: boolean },
  streakDays: number,
  totalSessionsThisWeek: number,
  prCount: number,
): string {
  const parts: string[] = [];

  if (totalSessionsThisWeek === 0) {
    return "No sessions logged this week yet. Start a session to get personalised coaching insights.";
  }

  parts.push(`You logged ${totalSessionsThisWeek} session${totalSessionsThisWeek !== 1 ? "s" : ""} this week.`);

  if (ergTrend && ergTrend.improvementSec > 0) {
    parts.push(`Your ${distLabel(ergTrend.distance)} erg split is trending ${ergTrend.improvementSec.toFixed(1)}s faster over ${ergTrend.sessions} sessions.`);
  } else if (ergTrend && ergTrend.improvementSec <= 0) {
    parts.push(`Your ${distLabel(ergTrend.distance)} erg split has been flat over the last ${ergTrend.sessions} sessions — consider a change of stimulus.`);
  }

  if (prCount > 0) {
    parts.push(`You came within range of ${prCount} personal record${prCount !== 1 ? "s" : ""} this week.`);
  }

  if (!load.sufficientHistory) {
    // No chronic baseline yet, so any verdict here — spike or optimal — would
    // be arithmetic dressed up as a judgement.
    parts.push(`Still building your training baseline, so load figures aren't meaningful yet.`);
  } else if (load.acwr > 1.3) {
    parts.push(`Training load is elevated (ACWR ${load.acwr}) — prioritise a recovery session before your next hard block.`);
  } else if (load.acwr < 0.8) {
    parts.push(`Training volume is low this week — adding one more session would keep your fitness on track.`);
  } else {
    parts.push(`Training load is in the optimal zone (ACWR ${load.acwr}).`);
  }

  if (streakDays > 0) {
    parts.push(`You're on a ${streakDays}-day training streak — keep it going.`);
  }

  return parts.join(" ");
}
