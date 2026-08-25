export type Severity = "ok" | "warn" | "severe";

export interface SplitFadeResult {
  kind: "split-fade";
  severity: Severity;
  segmentLabels: string[];         // e.g. ["500m", "1000m", "1500m", "2000m"]
  splitsSec: number[];             // mean split for each segment
  fadeSec: number;                 // slowest segment - first segment
  fadingSegment: string;           // label of worst segment
}

export interface PacingConsistencyResult {
  kind: "pacing-consistency";
  severity: Severity;
  stdDevSec: number;
  sampleCount: number;
}

export interface TrainingLoadResult {
  kind: "training-load";
  acwr: number;                    // acute:chronic workload ratio
  severity: Severity;              // ok | warn (low) | severe (high)
  weeklyLoadSRPE: number;
  monthlyAvgSRPE: number;
  /** Days between the athlete's first logged session and now. */
  historyDays: number;
  /** False until there is enough chronic base for ACWR to mean anything. */
  sufficientHistory: boolean;
}

export interface HighRPEStreakResult {
  kind: "high-rpe-streak";
  severity: Severity;
  streakLength: number;
  avgRpe: number;
}

export interface ModalityGapResult {
  kind: "modality-gap";
  severity: Severity;
  modality: "dryland" | "water" | "technique-video";
  daysSinceLastSession: number;
  threshold: number;
}

export interface BoatErgGapResult {
  kind: "boat-erg-gap";
  severity: Severity;
  ergSplitSec: number;
  waterSplitSec: number;
  gapSec: number;               // water minus erg (positive = water is slower)
  efficiency: number;           // erg / water — higher = more efficient transfer
}

export interface PRProximityResult {
  kind: "pr-proximity";
  severity: Severity;
  category: "erg" | "water";
  distanceM: number;
  prTimeSec: number;
  recentTimeSec: number;
  gapSec: number;               // pr - recent (positive = improvement over PR!)
  proximityFraction: number;
}

export interface PRTrendResult {
  kind: "pr-trend";
  severity: Severity;
  category: "erg" | "water";
  distanceM: number;
  improvementSec: number;       // positive = improving
  sessions: number;
}

export interface WeeklySummary {
  kind: "weekly-summary";
  text: string;                  // templated plain-language string
}

export type CoachInsight =
  | SplitFadeResult
  | PacingConsistencyResult
  | TrainingLoadResult
  | HighRPEStreakResult
  | ModalityGapResult
  | BoatErgGapResult
  | PRProximityResult
  | PRTrendResult;

export interface CoachOutput {
  summary: WeeklySummary;
  warnings: CoachInsight[];
  suggestions: CoachInsight[];
  positives: CoachInsight[];
  focusThisWeek: string;
}
