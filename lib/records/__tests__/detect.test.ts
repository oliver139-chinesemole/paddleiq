import { describe, it, expect } from "vitest";
import {
  isRecordAttempt,
  evaluateRecord,
  candidateFromSession,
  PR_DISTANCES,
  type ExistingPR,
} from "../detect";

describe("isRecordAttempt", () => {
  it("accepts a continuous effort at a standard distance", () => {
    expect(isRecordAttempt({ distance_m: 2000, duration_sec: 480, workout_type: "test" })).toBe(true);
    expect(isRecordAttempt({ distance_m: 500, duration_sec: 118, workout_type: "steady" })).toBe(true);
  });

  it("accepts every distance the Records page displays", () => {
    // Otherwise a card on that page can never be filled in.
    for (const d of PR_DISTANCES) {
      expect(isRecordAttempt({ distance_m: d, duration_sec: 120 }), `${d}m`).toBe(true);
    }
  });

  it("rejects a distance the app keeps no record at", () => {
    // A 6k steady piece is not a record at anything.
    expect(isRecordAttempt({ distance_m: 6000, duration_sec: 1500 })).toBe(false);
    expect(isRecordAttempt({ distance_m: 1500, duration_sec: 400 })).toBe(false);
  });

  it("rejects interval work at a standard distance", () => {
    // 4 x 500m is 2000m on the clock including the rests — it is not a 2k.
    expect(isRecordAttempt({ distance_m: 2000, duration_sec: 900, workout_type: "intervals" })).toBe(false);
    expect(isRecordAttempt({ distance_m: 2000, duration_sec: 900, workout_type: "pyramid" })).toBe(false);
  });

  it("rejects a session with nothing to time", () => {
    expect(isRecordAttempt({ distance_m: 2000 })).toBe(false);
    expect(isRecordAttempt({ distance_m: 2000, duration_sec: 0 })).toBe(false);
    expect(isRecordAttempt({ duration_sec: 480 })).toBe(false);
    expect(isRecordAttempt({})).toBe(false);
  });
});

describe("evaluateRecord", () => {
  const none: ExistingPR[] = [];
  const has2k: ExistingPR[] = [{ category: "erg", distance_m: 2000, time_sec: 480 }];

  it("records a first result at a distance", () => {
    const pr = evaluateRecord(none, { category: "erg", distance_m: 2000, time_sec: 512, date: "2026-06-10" });
    expect(pr).not.toBeNull();
    expect(pr!.time_sec).toBe(512);
    // Nothing was beaten, so there is no improvement to report.
    expect(pr!.previous_time_sec).toBeUndefined();
    expect(pr!.improvement_sec).toBeUndefined();
  });

  it("records a faster result and what it beat", () => {
    const pr = evaluateRecord(has2k, { category: "erg", distance_m: 2000, time_sec: 468, date: "2026-06-11" });
    expect(pr!.time_sec).toBe(468);
    expect(pr!.previous_time_sec).toBe(480);
    expect(pr!.improvement_sec).toBe(12);
  });

  it("ignores a slower result", () => {
    expect(evaluateRecord(has2k, { category: "erg", distance_m: 2000, time_sec: 495, date: "2026-06-11" })).toBeNull();
  });

  it("ignores matching your best", () => {
    // Equalling is not beating. Treating it as a PR would move the date and
    // report a 0-second improvement.
    expect(evaluateRecord(has2k, { category: "erg", distance_m: 2000, time_sec: 480, date: "2026-06-11" })).toBeNull();
  });

  it("keeps erg and water apart", () => {
    // An erg time and a boat time over the same distance are different events.
    const pr = evaluateRecord(has2k, { category: "water", distance_m: 2000, time_sec: 600, date: "2026-06-11" });
    expect(pr).not.toBeNull();
    expect(pr!.category).toBe("water");
    expect(pr!.previous_time_sec).toBeUndefined();
  });

  it("keeps distances apart", () => {
    const pr = evaluateRecord(has2k, { category: "erg", distance_m: 500, time_sec: 118, date: "2026-06-11" });
    expect(pr!.distance_m).toBe(500);
    expect(pr!.previous_time_sec).toBeUndefined();
  });

  it("rounds the improvement rather than reporting false precision", () => {
    const pr = evaluateRecord(
      [{ category: "erg", distance_m: 500, time_sec: 118.7 }],
      { category: "erg", distance_m: 500, time_sec: 114.2, date: "2026-06-11" },
    );
    expect(pr!.improvement_sec).toBe(5);
  });

  it("refuses nonsense instead of storing it", () => {
    expect(evaluateRecord(none, { category: "erg", distance_m: 2000, time_sec: 0, date: "2026-06-10" })).toBeNull();
    expect(evaluateRecord(none, { category: "erg", distance_m: 0, time_sec: 480, date: "2026-06-10" })).toBeNull();
  });

  it("improves repeatedly across a season", () => {
    // Each new best should chain off the one before, not off the original.
    let prs: ExistingPR[] = [];
    for (const [time, expectedImprovement] of [[500, undefined], [490, 10], [475, 15]] as const) {
      const pr = evaluateRecord(prs, { category: "erg", distance_m: 2000, time_sec: time, date: "2026-06-10" })!;
      expect(pr.improvement_sec).toBe(expectedImprovement);
      prs = [{ category: "erg", distance_m: 2000, time_sec: pr.time_sec }];
    }
  });
});

describe("candidateFromSession", () => {
  it("builds a candidate from a qualifying session", () => {
    const c = candidateFromSession("erg", {
      distance_m: 2000, duration_sec: 480, date: "2026-06-10", workout_type: "test",
    });
    expect(c).toEqual({ category: "erg", distance_m: 2000, time_sec: 480, date: "2026-06-10" });
  });

  it("returns null for a session that isn't an attempt", () => {
    expect(candidateFromSession("erg", { distance_m: 6000, duration_sec: 1500, date: "2026-06-10" })).toBeNull();
    expect(candidateFromSession("erg", { distance_m: 2000, duration_sec: 900, date: "2026-06-10", workout_type: "intervals" })).toBeNull();
  });

  it("returns null without a date to record it against", () => {
    expect(candidateFromSession("erg", { distance_m: 2000, duration_sec: 480 })).toBeNull();
  });
});
