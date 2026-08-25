/**
 * Configurable thresholds for the coaching rules engine.
 * All values are in SI units (seconds, metres, etc.) unless noted.
 */
export const THRESHOLDS = {
  // Split fade (within a 2k erg split into 4 × 500m segments)
  splitFadeWarnSec: 3,       // flag if any later segment is >3s/500m slower than the first
  splitFadeSevereSec: 6,     // severe flag

  // Pacing consistency (std dev of interval splits)
  pacingVarianceWarnSec: 4,
  pacingVarianceSevereSec: 8,

  // sRPE = RPE × duration_minutes
  // Acute:Chronic Workload Ratio band
  acwrLow: 0.8,              // undertraining / detraining below this
  acwrHigh: 1.3,             // overreaching / injury risk above this
  acwrMinHistoryDays: 21,    // ACWR is meaningless without a chronic base

  // High-RPE streak
  highRpeMinimum: 8,         // what counts as "high RPE"
  highRpeStreakWarn: 3,      // consecutive high-RPE sessions → recovery nudge

  // Modality gaps (in days)
  drylandGapDays: 7,
  waterGapDays: 14,
  techniqueVideoGapDays: 14,

  // Boat vs erg efficiency gap (seconds per 500m)
  efficiencyGapWarnSec: 15,
  efficiencyGapSevereSec: 30,

  // PR proximity — flag when within this fraction of a PR
  prProximityFraction: 0.05, // within 5% of PR time
  prProximityWindowDays: 14, // only look back this far for a near-PR effort
} as const;
