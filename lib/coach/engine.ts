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
import type { CoachOutput, CoachInsight } from "./types";

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
  const gaps = checkModalityGaps(drylandSessions, waterSessions, now);
  const boatErgGap = checkBoatErgGap(ergSessions, waterSessions);
  const prProximity = checkPRProximity(ergSessions, waterSessions, prs);
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
  const weekCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sessionsThisWeek = allSessions.filter((s) => new Date(s.date) >= weekCutoff).length;
  const prNearCount = prProximity.length;
  const streakDays = (() => {
    const sorted = [...allSessions]
      .map((s) => s.date)
      .sort()
      .reverse();
    let days = 0;
    let prev = now.toISOString().split("T")[0];
    for (const d of sorted) {
      const diff = (new Date(prev).getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 1) { days++; prev = d; }
      else break;
    }
    return days;
  })();

  const summaryText = buildWeeklySummary(
    ergTrend ? { improvementSec: ergTrend.improvementSec, sessions: ergTrend.sessions, distance: ergTrend.distanceM } : null,
    { acwr: load.acwr, weeklyLoadSRPE: load.weeklyLoadSRPE },
    streakDays,
    sessionsThisWeek,
    prNearCount,
  );

  // ── Focus of the week (highest-severity suggestion) ────────────────────────
  const topSuggestion = warnings[0] ?? suggestions[0];
  const focusThisWeek = topSuggestion
    ? insightTitle(topSuggestion)
    : "Maintain current training consistency — no issues detected.";

  // ── Fixed question answers ────────────────────────────────────────────────
  const questionAnswers: Record<string, string> = {
    "Why is my 2nd 500m slower in the 2k?": splitFade
      ? insightBody(splitFade)
      : "Log at least one 2k erg session to get a personalised answer.",

    "Am I overtraining?": load.acwr > 1.3
      ? insightBody(load)
      : load.acwr < 0.8
      ? insightBody(load)
      : `No. Your training load (ACWR ${load.acwr}) is in the optimal 0.8–1.3 band. Your weekly sRPE is ${load.weeklyLoadSRPE} vs a 4-week average of ${load.monthlyAvgSRPE}.`,

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

    "What should I focus on this week?": topSuggestion
      ? `${insightTitle(topSuggestion)}\n\n${insightBody(topSuggestion)}`
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
    warnings: render(warnings),
    suggestions: render(suggestions),
    positives: render(positives),
    questionAnswers,
  };
}
