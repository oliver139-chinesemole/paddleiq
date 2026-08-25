/**
 * Integration tests for the coach engine.
 *
 * rules.ts is tested in isolation; this covers the seam where the rule results
 * are categorised and rendered into what the athlete actually reads. That seam
 * is where the inverted PR sign lived — the rule and the copy each looked
 * self-consistent, and only disagreed when read together.
 */
import { describe, it, expect } from "vitest";
import { runCoachEngine, type EngineInput } from "../engine";
import type { ErgSessionInput, WaterSessionInput, DrylandSessionInput, TeamSessionInput } from "../rules";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-15T12:00:00");

const d = (daysAgo: number) => {
  const x = new Date(NOW);
  x.setDate(x.getDate() - daysAgo);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const erg = (o: Partial<ErgSessionInput> = {}): ErgSessionInput => ({
  date: d(1), rpe: 7, duration_sec: 480, distance_m: 2000, split_sec: 120, ...o,
});

const water = (o: Partial<WaterSessionInput> = {}): WaterSessionInput => ({
  date: d(1), rpe: 6, duration_sec: 1800, distance_m: 5000, avg_pace_sec: 180, ...o,
});

const dryland = (o: Partial<DrylandSessionInput> = {}): DrylandSessionInput => ({
  date: d(2), rpe: 6, duration_min: 45, ...o,
});

const team = (o: Partial<TeamSessionInput> = {}): TeamSessionInput => ({
  date: d(3), rpe: 6, duration_min: 90, ...o,
});

const input = (o: Partial<EngineInput> = {}): EngineInput => ({
  ergSessions: [], waterSessions: [], drylandSessions: [], teamSessions: [],
  prs: [], now: NOW, ...o,
});

// ── Shape ────────────────────────────────────────────────────────────────────

describe("runCoachEngine", () => {
  it("always returns a complete output", () => {
    const out = runCoachEngine(input());
    expect(typeof out.summary).toBe("string");
    expect(out.summary.length).toBeGreaterThan(0);
    expect(typeof out.focusThisWeek).toBe("string");
    expect(Array.isArray(out.warnings)).toBe(true);
    expect(Array.isArray(out.suggestions)).toBe(true);
    expect(Array.isArray(out.positives)).toBe(true);
  });

  it("survives an athlete with no history at all", () => {
    const out = runCoachEngine(input());
    expect(out.summary).not.toMatch(/NaN|undefined|Infinity/);
    expect(out.focusThisWeek).not.toMatch(/NaN|undefined/);
    for (const a of Object.values(out.questionAnswers)) {
      expect(a).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("answers every preset question with something usable", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg(), erg({ date: d(3) })],
      waterSessions: [water()],
    }));
    const answers = Object.entries(out.questionAnswers);
    expect(answers.length).toBeGreaterThanOrEqual(5);
    for (const [q, a] of answers) {
      expect(q.length).toBeGreaterThan(5);
      expect(a.length).toBeGreaterThan(10);
      expect(a).not.toMatch(/NaN|undefined/);
    }
  });

  it("renders every insight with a title and a body", () => {
    const out = runCoachEngine(input({
      ergSessions: Array.from({ length: 5 }, (_, i) => erg({ date: d(i + 1), rpe: 9 })),
      drylandSessions: [],
    }));
    const all = [...out.warnings, ...out.suggestions, ...out.positives];
    expect(all.length).toBeGreaterThan(0);
    for (const i of all) {
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.body.length).toBeGreaterThan(0);
      expect(i.title).not.toMatch(/NaN|undefined/);
      expect(i.body).not.toMatch(/NaN|undefined/);
      expect(["ok", "warn", "severe"]).toContain(i.severity);
    }
  });
});

// ── PR sign convention ───────────────────────────────────────────────────────

describe("PR proximity routing", () => {
  it("celebrates a beaten PR as a positive", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg({ date: d(2), distance_m: 500, duration_sec: 118, split_sec: 118 })],
      prs: [{ category: "erg", distance_m: 500, time_sec: 125 }],
    }));
    const pr = out.positives.find((p) => p.kind === "pr-proximity");
    expect(pr).toBeDefined();
    // Regression: with the sign inverted this landed in suggestions and read
    // "within 7s of your PR" for a session that beat it by 7s.
    expect(pr!.body).toMatch(/beaten|Outstanding/i);
    expect(out.suggestions.find((s) => s.kind === "pr-proximity")).toBeUndefined();
  });

  it("treats a near miss as a suggestion, not a celebration", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg({ date: d(2), distance_m: 500, duration_sec: 127, split_sec: 127 })],
      prs: [{ category: "erg", distance_m: 500, time_sec: 125 }],
    }));
    const pr = out.suggestions.find((s) => s.kind === "pr-proximity");
    expect(pr).toBeDefined();
    expect(pr!.body).toMatch(/within/i);
    expect(out.positives.find((p) => p.kind === "pr-proximity")).toBeUndefined();
  });

  it("says nothing about a PR the athlete is nowhere near", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg({ date: d(2), distance_m: 500, duration_sec: 190, split_sec: 190 })],
      prs: [{ category: "erg", distance_m: 500, time_sec: 125 }],
    }));
    const all = [...out.positives, ...out.suggestions, ...out.warnings];
    expect(all.find((i) => i.kind === "pr-proximity")).toBeUndefined();
  });
});

// ── Clock handling ───────────────────────────────────────────────────────────

describe("clock", () => {
  it("honours the supplied date for PR proximity", () => {
    // Regression: the engine never passed `now` through, so this rule read the
    // real clock and these fixtures fell outside its 14-day window.
    const sessions = [erg({ date: d(2), distance_m: 500, duration_sec: 118, split_sec: 118 })];
    const prs = [{ category: "erg" as const, distance_m: 500, time_sec: 125 }];

    const withinWindow = runCoachEngine(input({ ergSessions: sessions, prs, now: NOW }));
    expect(withinWindow.positives.find((p) => p.kind === "pr-proximity")).toBeDefined();

    // Same sessions, but the clock has moved on a year — nothing is recent.
    const later = runCoachEngine(input({
      ergSessions: sessions, prs, now: new Date("2027-06-15T12:00:00"),
    }));
    const all = [...later.positives, ...later.suggestions];
    expect(all.find((i) => i.kind === "pr-proximity")).toBeUndefined();
  });

  it("counts a double training day once in the streak", () => {
    // Regression: walking the session list let each extra session on a day add
    // a phantom streak day, so this reported 3.
    const out = runCoachEngine(input({
      ergSessions: [erg({ date: d(0) }), erg({ date: d(0) })],
      waterSessions: [water({ date: d(1) })],
    }));
    expect(out.summary).toMatch(/2[- ]day/);
    expect(out.summary).not.toMatch(/3[- ]day/);
  });

  it("keeps the streak alive before today's session", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg({ date: d(1) }), erg({ date: d(2) })],
    }));
    expect(out.summary).toMatch(/2[- ]day/);
  });
});

// ── Categorisation ───────────────────────────────────────────────────────────

describe("categorisation", () => {
  it("files a high-RPE streak as a warning", () => {
    const out = runCoachEngine(input({
      ergSessions: [
        erg({ date: d(1), rpe: 9 }), erg({ date: d(2), rpe: 9 }), erg({ date: d(3), rpe: 9 }),
      ],
    }));
    expect(out.warnings.find((w) => w.kind === "high-rpe-streak")).toBeDefined();
  });

  it("flags a long gap in dryland training", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg()],
      drylandSessions: [dryland({ date: d(60) })],
    }));
    const gap = [...out.warnings, ...out.suggestions].find((i) => i.kind === "modality-gap");
    expect(gap).toBeDefined();
  });

  it("picks the most serious item as this week's focus", () => {
    const out = runCoachEngine(input({
      ergSessions: [
        erg({ date: d(1), rpe: 9 }), erg({ date: d(2), rpe: 9 }), erg({ date: d(3), rpe: 9 }),
      ],
    }));
    expect(out.focusThisWeek.length).toBeGreaterThan(0);
    expect(out.focusThisWeek).not.toMatch(/no issues detected/i);
  });

  it("falls back to a neutral focus when nothing is wrong", () => {
    const out = runCoachEngine(input({
      ergSessions: [erg({ date: d(1), rpe: 5 })],
      drylandSessions: [dryland({ date: d(1) })],
      waterSessions: [water({ date: d(1) })],
      teamSessions: [team({ date: d(2) })],
    }));
    expect(out.focusThisWeek.length).toBeGreaterThan(0);
  });

  it("counts only this week's sessions in the summary", () => {
    const recent = runCoachEngine(input({
      ergSessions: [erg({ date: d(1) }), erg({ date: d(2) })],
    }));
    const stale = runCoachEngine(input({
      ergSessions: [erg({ date: d(40) }), erg({ date: d(41) })],
    }));
    expect(recent.summary).not.toBe(stale.summary);
  });
});
