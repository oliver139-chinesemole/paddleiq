/**
 * Unit tests for the effort scale.
 *
 * The picker shows five levels; the stored value stays on the 1–10 scale
 * because training load is RPE × duration and ACWR compares against a
 * four-week baseline. Changing the stored units would break both the maths and
 * every session already logged, so the mapping is the thing to pin down.
 */
import { describe, it, expect } from "vitest";
import { EFFORT_LEVELS, effortToStored, storedToEffort, effortLevel } from "../effort";
import { rpeLabel } from "../utils";

describe("EFFORT_LEVELS", () => {
  it("offers five levels", () => {
    expect(EFFORT_LEVELS).toHaveLength(5);
    expect(EFFORT_LEVELS.map((e) => e.level)).toEqual([1, 2, 3, 4, 5]);
  });

  it("stores values spread across the full 1–10 range", () => {
    expect(EFFORT_LEVELS.map((e) => e.stored)).toEqual([2, 4, 6, 8, 10]);
  });

  it("lands each level on the band rpeLabel already used", () => {
    // The five levels exist because rpeLabel had exactly five bands; if that
    // stops lining up, the picker and the rest of the app disagree.
    expect(EFFORT_LEVELS.map((e) => rpeLabel(e.stored)))
      .toEqual(["Easy", "Moderate", "Hard", "Very Hard", "Max"]);
  });

  it("gives every level an answerable cue", () => {
    for (const e of EFFORT_LEVELS) {
      expect(e.cue.length, `level ${e.level}`).toBeGreaterThan(10);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("gets harder as the level rises", () => {
    const stored = EFFORT_LEVELS.map((e) => e.stored);
    expect([...stored].sort((a, b) => a - b)).toEqual(stored);
  });
});

describe("effortToStored", () => {
  it("maps each level to its stored value", () => {
    expect(effortToStored(1)).toBe(2);
    expect(effortToStored(3)).toBe(6);
    expect(effortToStored(5)).toBe(10);
  });

  it("falls back to the middle for an unknown level", () => {
    expect(effortToStored(0)).toBe(6);
    expect(effortToStored(99)).toBe(6);
  });
});

describe("storedToEffort", () => {
  it("round-trips every level", () => {
    for (const e of EFFORT_LEVELS) {
      expect(storedToEffort(e.stored)).toBe(e.level);
    }
  });

  it("places odd values from older sessions in a sensible band", () => {
    // Sessions logged before this change could hold any value 1–10; they must
    // still show a selection rather than nothing.
    expect(storedToEffort(1)).toBe(1);
    expect(storedToEffort(3)).toBe(2);
    expect(storedToEffort(5)).toBe(3);
    expect(storedToEffort(7)).toBe(4);
    expect(storedToEffort(9)).toBe(5);
  });

  it("clamps out-of-range and nonsense values", () => {
    expect(storedToEffort(0)).toBe(1);
    expect(storedToEffort(-4)).toBe(1);
    expect(storedToEffort(50)).toBe(5);
    expect(storedToEffort(NaN)).toBe(3);
  });

  it("always returns a level that exists", () => {
    for (let rpe = 0; rpe <= 12; rpe++) {
      expect(effortLevel(storedToEffort(rpe))).toBeDefined();
    }
  });
});
