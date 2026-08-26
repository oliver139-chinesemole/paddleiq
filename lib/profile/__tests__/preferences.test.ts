// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parsePreferences,
  hasPreferences,
  loadPreferences,
  savePreferences,
  clearPreferences,
  fromOnboardingAnswers,
  toOnboardingAnswers,
  roleLabel,
  envLabel,
  goalLabel,
  distanceLabel,
  EMPTY_PREFERENCES,
  PREFERENCES_KEY,
  type Preferences,
} from "../preferences";

const NOW = "2026-08-26T12:00:00.000Z";

beforeEach(() => window.localStorage.clear());

describe("parsePreferences", () => {
  it("reads back what was written", () => {
    const p: Preferences = {
      role: "competitive",
      trainingEnv: ["erg", "team_boat"],
      goals: ["race"],
      preferredDistances: [500, 2000],
    };
    expect(parsePreferences(JSON.stringify(p))).toMatchObject(p);
  });

  it("returns empties for nothing stored", () => {
    expect(parsePreferences(null)).toEqual(EMPTY_PREFERENCES);
    expect(parsePreferences("")).toEqual(EMPTY_PREFERENCES);
  });

  it("survives corrupt JSON instead of throwing mid-render", () => {
    // This value outlives the code that wrote it; a parse error here would
    // take down every page that reads preferences.
    expect(parsePreferences("{not json")).toEqual(EMPTY_PREFERENCES);
    expect(parsePreferences("null")).toEqual(EMPTY_PREFERENCES);
    expect(parsePreferences("[1,2,3]")).toEqual(EMPTY_PREFERENCES);
    expect(parsePreferences('"a string"')).toEqual(EMPTY_PREFERENCES);
  });

  it("drops a role it doesn't recognise", () => {
    // An older build's value, or someone editing localStorage by hand.
    expect(parsePreferences('{"role":"admiral"}').role).toBeUndefined();
    expect(parsePreferences('{"role":123}').role).toBeUndefined();
  });

  it("keeps only strings in the list fields", () => {
    const p = parsePreferences('{"goals":["race",5,null,"team"],"trainingEnv":"erg"}');
    expect(p.goals).toEqual(["race", "team"]);
    // A bare string isn't a list; treat it as unset rather than splitting it.
    expect(p.trainingEnv).toEqual([]);
  });

  it("coerces distances and discards anything that isn't one", () => {
    // Onboarding stores these as strings. A stray entry becoming NaN would
    // render as "NaNm" on a plan.
    const p = parsePreferences('{"preferredDistances":["500",1000,"abc",null,0,-200]}');
    expect(p.preferredDistances).toEqual([500, 1000]);
  });

  it("ignores unknown extra keys", () => {
    const p = parsePreferences('{"goals":["race"],"somethingNew":true}');
    expect(p.goals).toEqual(["race"]);
  });
});

describe("hasPreferences", () => {
  it("is false for a fresh install", () => {
    expect(hasPreferences(EMPTY_PREFERENCES)).toBe(false);
  });

  it("is true once any single answer is given", () => {
    expect(hasPreferences({ ...EMPTY_PREFERENCES, role: "coach" })).toBe(true);
    expect(hasPreferences({ ...EMPTY_PREFERENCES, goals: ["race"] })).toBe(true);
    expect(hasPreferences({ ...EMPTY_PREFERENCES, preferredDistances: [500] })).toBe(true);
    expect(hasPreferences({ ...EMPTY_PREFERENCES, trainingEnv: ["erg"] })).toBe(true);
  });
});

describe("saving and loading", () => {
  it("round-trips through localStorage", () => {
    const p: Preferences = {
      role: "paddler",
      trainingEnv: ["erg"],
      goals: ["technique"],
      preferredDistances: [500],
    };
    expect(savePreferences(p, NOW)).toBe(true);
    expect(loadPreferences()).toMatchObject(p);
  });

  it("stamps when it was saved", () => {
    savePreferences({ ...EMPTY_PREFERENCES, role: "coach" }, NOW);
    expect(loadPreferences().updatedAt).toBe(NOW);
  });

  it("returns empties when nothing has been saved", () => {
    expect(loadPreferences()).toEqual(EMPTY_PREFERENCES);
  });

  it("recovers from a corrupt stored value", () => {
    window.localStorage.setItem(PREFERENCES_KEY, "{{{");
    expect(loadPreferences()).toEqual(EMPTY_PREFERENCES);
  });

  it("clears", () => {
    savePreferences({ ...EMPTY_PREFERENCES, role: "coach" }, NOW);
    clearPreferences();
    expect(loadPreferences()).toEqual(EMPTY_PREFERENCES);
  });

  // Stubbed on the prototype: jsdom's localStorage is a Proxy, so assigning
  // `localStorage.setItem = fn` stores an item *named* "setItem" rather than
  // replacing the method, and the stub never runs.
  it("reports failure rather than throwing when storage is blocked", () => {
    // Private browsing and some embedded webviews throw on setItem.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(savePreferences(EMPTY_PREFERENCES, NOW)).toBe(false);
    spy.mockRestore();
  });

  it("reads as empty rather than throwing when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadPreferences()).toEqual(EMPTY_PREFERENCES);
    spy.mockRestore();
  });
});

describe("onboarding answers", () => {
  const answers = {
    role: "competitive",
    env: ["erg", "team_boat"],
    goals: ["race", "endurance"],
    distance: ["500", "2000"],
  };

  it("converts the answer map into preferences", () => {
    expect(fromOnboardingAnswers(answers)).toEqual({
      role: "competitive",
      trainingEnv: ["erg", "team_boat"],
      goals: ["race", "endurance"],
      preferredDistances: [500, 2000],
    });
  });

  it("handles a half-finished run", () => {
    expect(fromOnboardingAnswers({ role: "paddler" })).toEqual({
      role: "paddler",
      trainingEnv: [],
      goals: [],
      preferredDistances: [],
    });
    expect(fromOnboardingAnswers({})).toEqual(EMPTY_PREFERENCES);
  });

  it("round-trips back into answers so onboarding can prefill", () => {
    // This is what makes onboarding usable as an editor rather than a
    // one-shot wizard that silently overwrites what was there.
    const prefs = fromOnboardingAnswers(answers);
    expect(toOnboardingAnswers(prefs)).toEqual({
      role: "competitive",
      env: ["erg", "team_boat"],
      goals: ["race", "endurance"],
      distance: ["500", "2000"],
    });
  });

  it("leaves role out of the answer map when unset", () => {
    // canAdvance() treats any present value as answered, so an undefined role
    // must not appear as a key at all.
    expect(toOnboardingAnswers(EMPTY_PREFERENCES)).not.toHaveProperty("role");
  });
});

describe("labels", () => {
  it("names the options a person chose", () => {
    expect(roleLabel("competitive")).toBe("Competitive Racer");
    expect(envLabel("solo_water")).toBe("Solo Water");
    expect(goalLabel("erg_score")).toBe("Better Erg Score");
  });

  it("falls back to the raw value for an option it doesn't know", () => {
    // Better to show "kayak" than a blank chip.
    expect(envLabel("kayak")).toBe("kayak");
    expect(goalLabel("something_new")).toBe("something_new");
  });

  it("has nothing to show for an unset role", () => {
    expect(roleLabel(undefined)).toBeUndefined();
  });

  it("formats distances the way the rest of the app does", () => {
    expect(distanceLabel(500)).toBe("500m");
    expect(distanceLabel(2000)).toBe("2km");
  });
});
