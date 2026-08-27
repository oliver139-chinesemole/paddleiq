/**
 * Coach engine — runs all rules over the user's session history and returns
 * a structured CoachOutput. Pure: no side effects, no external calls.
 */
import {
  checkSplitFade, checkPacingConsistency, calculateTrainingLoad,
  checkHighRPEStreak, checkModalityGaps, checkBoatErgGap,
  checkPRProximity, computePRTrend,
  type ErgSessionInput, type WaterSessionInput, type DrylandSessionInput,
  type TeamSessionInput, type PRInput,
} from "./rules";
import { buildWeeklySummary, insightTitle, insightBody } from "./templates";
import { THRESHOLDS } from "./thresholds";
import { computeStreak, toLocalDateStr, daysBefore } from "@/lib/utils";
import type { CoachInsight } from "./types";

export interface EngineInput {
  ergSessions: ErgSessionInput[];
  waterSessions: WaterSessionInput[];
  drylandSessions: DrylandSessionInput[];
  teamSessions: TeamSessionInput[];
  prs: PRInput[];
  now?: Date;
}

/** Rendered insight — title + explanation ready to display */
export interface RenderedInsight {
  kind: CoachInsight["kind"];
  severity: "ok" | "warn" | "severe";
  title: string;
  body: string;
}

export interface RenderedCoachOutput {
  summary: string;
  focusThisWeek: string;
  warnings: RenderedInsight[];
  suggestions: RenderedInsight[];
  positives: RenderedInsight[];
  questionAnswers: Record<string, string>;
}

export function runCoachEngine(input: EngineInput): RenderedCoachOutput {
  const now = input.now ?? new Date();
  const { ergSessions, waterSessions, drylandSessions, teamSessions, prs } = input;
  const allSessions = [
    ...ergSessions.map((s) => ({ ...s, duration_min: s.duration_sec / 60 })),
    ...waterSessions.map((s) => ({ ...s, duration_min: s.duration_sec / 60 })),
    ...drylandSessions,
    ...teamSessions,
  ];

  // ── Run all rules ─────────────────────────────────────────────────────────
  const splitFade = checkSplitFade(ergSessions);
  const pacing = checkPacingConsistency(ergSessions);
  const load = calculateTrainingLoad(allSessions, now);
  const streak = checkHighRPEStreak(allSessions);
  // The earliest session of any kind: a gap can't be longer than the athlete
  // has been training.
  const firstSessionDate = allSessions.map((s) => s.date).sort()[0];
  const gaps = checkModalityGaps(drylandSessions, waterSessions, now, firstSessionDate);
  const boatErgGap = checkBoatErgGap(ergSessions, waterSessions);
  // `now` matters here too — without it this rule reads the real clock and
  // ignores the caller's date, which is exactly what made it untestable.
  const prProximity = checkPRProximity(ergSessions, waterSessions, prs, now);
  const ergTrend = computePRTrend(ergSessions, 2000) ?? computePRTrend(ergSessions, 500);

  // ── Categorise by severity ────────────────────────────────────────────────
  const warnings: CoachInsight[] = [];
  const suggestions: CoachInsight[] = [];
  const positives: CoachInsight[] = [];

  function categorise(insight: CoachInsight | null) {
    if (!insight) return;
    if (insight.severity === "ok") positives.push(insight);
    else if (insight.severity === "warn") suggestions.push(insight);
    else warnings.push(insight);
  }

  categorise(splitFade);
  categorise(pacing);
  categorise(load);
  if (streak) warnings.push(streak); // always a warning when it fires
  gaps.forEach(categorise);
  if (boatErgGap) categorise(boatErgGap);
  prProximity.forEach((p) => {
    if (p.gapSec <= 0) positives.push(p);       // PR beaten!
    else suggestions.push(p);                     // near-PR
  });
  if (ergTrend) {
    if (ergTrend.improvementSec > 0) positives.push(ergTrend);
    else suggestions.push(ergTrend);
  }

  // ── Weekly summary ────────────────────────────────────────────────────────
  const weekCutoff = toLocalDateStr(daysBefore(now, 6));
  const sessionsThisWeek = allSessions.filter((s) => s.date >= weekCutoff).length;
  const prNearCount = prProximity.length;

  // Shared with the dashboard so the two can't report different streaks. The
  // local version walked the session list, so a double training day counted
  // twice, and it read "today" in UTC.
  const streakDays = computeStreak(new Set(allSessions.map((s) => s.date)), now);

  const summaryText = buildWeeklySummary(
    ergTrend ? { improvementSec: ergTrend.improvementSec, sessions: ergTrend.sessions, distance: ergTrend.distanceM } : null,
    { acwr: load.acwr, weeklyLoadSRPE: load.weeklyLoadSRPE, sufficientHistory: load.sufficientHistory },
    streakDays,
    sessionsThisWeek,
    prNearCount,
  );

  // ── Focus of the week (highest-severity suggestion) ────────────────────────
  // Promoted out of its list rather than copied from it. The focus was
  // previously just warnings[0] rendered again, so the page showed the same
  // sentence under "Focus this week" and immediately again under "Watch out".
  const promoted = warnings[0] ?? suggestions[0];
  const focusThisWeek = promoted
    ? insightTitle(promoted)
    : "Maintain current training consistency — no issues detected.";
  const remainingWarnings = promoted ? warnings.filter((w) => w !== promoted) : warnings;
  const remainingSuggestions = promoted ? suggestions.filter((x) => x !== promoted) : suggestions;

  // ── Fixed question answers ────────────────────────────────────────────────
  const questionAnswers: Record<string, string> = {
    "Why is my 2nd 500m slower in the 2k?": splitFade
      ? insightBody(splitFade)
      : "Log at least one 2k erg session to get a personalised answer.",

    // Answering "no, you're fine" on a baseline that doesn't exist yet is as
    // misleading as crying overtraining, so defer to the same copy the insight
    // uses when there isn't enough history.
    "Am I overtraining?": !load.sufficientHistory
      ? insightBody(load)
      : load.acwr > THRESHOLDS.acwrHigh || load.acwr < THRESHOLDS.acwrLow
      ? insightBody(load)
      : `No. Your training load (ACWR ${load.acwr}) is in the optimal ${THRESHOLDS.acwrLow}–${THRESHOLDS.acwrHigh} band. Your weekly sRPE is ${load.weeklyLoadSRPE} vs a 4-week average of ${load.monthlyAvgSRPE}.`,

    "Which distance am I improving fastest at?": (() => {
      const trends = [500, 1000, 2000]
        .map((d) => computePRTrend(ergSessions, d))
        .filter(Boolean) as ReturnType<typeof computePRTrend>[];
      if (trends.length === 0) return "Log at least 2 sessions at the same distance to see improvement trends.";
      const best = trends.sort((a, b) => b!.improvementSec - a!.improvementSec)[0]!;
      return insightBody(best);
    })(),

    "How is my water-to-erg transfer?": boatErgGap
      ? insightBody(boatErgGap)
      : "Log both a 500m erg session and a 500m solo water time trial to see your transfer efficiency.",

    "What should I focus on this week?": promoted
      ? `${insightTitle(promoted)}\n\n${insightBody(promoted)}`
      : "Your training looks balanced — no critical issues. Consider adding a technique video session this week.",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  function render(insights: CoachInsight[]): RenderedInsight[] {
    return insights.map((i) => ({
      kind: i.kind,
      severity: i.severity,
      title: insightTitle(i),
      body: insightBody(i),
    }));
  }

  return {
    summary: summaryText,
    focusThisWeek,
    warnings: render(remainingWarnings),
    suggestions: render(remainingSuggestions),
    positives: render(positives),
    questionAnswers,
  };
}
