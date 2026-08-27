/**
 * Unit tests for the shared formatting helpers.
 *
 * These render times, paces and dates on nearly every screen, so a defect here
 * is visible everywhere at once — which is what happened: dates displayed a day
 * early throughout the app, and paces could read "2:60".
 */
import { describe, it, expect } from "vitest";
import {
  formatTime,
  formatPace,
  formatDistance,
  formatDate,
  formatRelativeDate,
  parseLocalDate,
  calendarDaysBetween,
  calcPacePer500m,
  strokeRateLabel,
  rpeLabel,
  rpeColor, parseSplit } from "../utils";

const at = (iso: string) => new Date(`${iso}T12:00:00`);

// ── Durations ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats whole seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59)).toBe("0:59");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(125)).toBe("2:05");
    expect(formatTime(3600)).toBe("60:00");
  });

  it("rounds fractional seconds instead of leaking the float", () => {
    // Regression: this produced "1:5.700000000000003".
    expect(formatTime(65.7)).toBe("1:06");
    expect(formatTime(65.2)).toBe("1:05");
  });

  it("carries a rounded 60 into the next minute", () => {
    // Regression: rounding the remainder alone gave "2:60".
    expect(formatTime(179.6)).toBe("3:00");
    expect(formatTime(119.5)).toBe("2:00");
  });

  it("keeps negative durations readable", () => {
    // Regression: this produced "-1:-5".
    expect(formatTime(-5)).toBe("-0:05");
    expect(formatTime(-65)).toBe("-1:05");
  });

  it("falls back rather than printing NaN", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
  });
});

describe("formatPace", () => {
  it("appends the per-500m unit", () => {
    expect(formatPace(120)).toBe("2:00/500m");
    expect(formatPace(125)).toBe("2:05/500m");
  });

  it("carries a rounded 60 into the next minute", () => {
    expect(formatPace(179.6)).toBe("3:00/500m");
  });
});

// ── Distance ─────────────────────────────────────────────────────────────────

describe("formatDistance", () => {
  it("uses metres below a kilometre", () => {
    expect(formatDistance(500)).toBe("500m");
    expect(formatDistance(999)).toBe("999m");
    expect(formatDistance(0)).toBe("0m");
  });

  it("switches to kilometres at 1000m", () => {
    expect(formatDistance(1000)).toBe("1.00km");
    expect(formatDistance(2500)).toBe("2.50km");
  });

  it("rounds stray decimals in the metres branch", () => {
    expect(formatDistance(499.6)).toBe("500m");
  });

  it("falls back rather than printing NaN", () => {
    expect(formatDistance(NaN)).toBe("0m");
  });
});

// ── Dates ────────────────────────────────────────────────────────────────────

describe("parseLocalDate", () => {
  it("reads a plain date string as local midnight", () => {
    // Regression: the Date constructor treats this as UTC, which is the
    // previous evening in the Americas.
    const d = parseLocalDate("2026-06-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("passes a Date through untouched", () => {
    const d = at("2026-06-15");
    expect(parseLocalDate(d)).toBe(d);
  });

  it("still handles a full timestamp string", () => {
    const d = parseLocalDate("2026-06-15T18:30:00");
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(18);
  });
});

describe("formatDate", () => {
  it("shows the day that was actually stored", () => {
    // Regression: rendered "Jun 14, 2026" anywhere behind UTC.
    expect(formatDate("2026-06-15")).toBe("Jun 15, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("accepts a Date as well as a string", () => {
    expect(formatDate(at("2026-06-15"))).toBe("Jun 15, 2026");
  });
});

describe("calendarDaysBetween", () => {
  it("counts whole days regardless of the time of day", () => {
    expect(calendarDaysBetween(new Date("2026-06-15T23:00:00"), new Date("2026-06-16T01:00:00"))).toBe(1);
    expect(calendarDaysBetween(new Date("2026-06-15T01:00:00"), new Date("2026-06-15T23:00:00"))).toBe(0);
  });

  it("goes negative for future dates", () => {
    expect(calendarDaysBetween(at("2026-06-16"), at("2026-06-15"))).toBe(-1);
  });

  it("spans month boundaries", () => {
    expect(calendarDaysBetween(at("2026-06-28"), at("2026-07-02"))).toBe(4);
  });
});

describe("formatRelativeDate", () => {
  const NOW = new Date("2026-06-15T20:00:00"); // evening, the failure case

  it("calls a session logged today Today, even late in the evening", () => {
    // Regression: elapsed-milliseconds arithmetic made this "Yesterday" from
    // early evening onward.
    expect(formatRelativeDate("2026-06-15", NOW)).toBe("Today");
  });

  it("recognises yesterday", () => {
    expect(formatRelativeDate("2026-06-14", NOW)).toBe("Yesterday");
  });

  it("counts days within the last week", () => {
    expect(formatRelativeDate("2026-06-12", NOW)).toBe("3 days ago");
    expect(formatRelativeDate("2026-06-10", NOW)).toBe("5 days ago");
  });

  it("falls back to a full date beyond a week", () => {
    expect(formatRelativeDate("2026-06-01", NOW)).toBe("Jun 1, 2026");
  });

  it("shows a full date for future entries rather than negative days", () => {
    // Regression: this produced "-1 days ago".
    expect(formatRelativeDate("2026-06-16", NOW)).toBe("Jun 16, 2026");
  });

  it("works at midday as well as at night", () => {
    expect(formatRelativeDate("2026-06-15", new Date("2026-06-15T09:00:00"))).toBe("Today");
  });
});

// ── Derived values ───────────────────────────────────────────────────────────

describe("calcPacePer500m", () => {
  it("scales duration to 500m", () => {
    expect(calcPacePer500m(1000, 240)).toBe(120);
    expect(calcPacePer500m(500, 120)).toBe(120);
    expect(calcPacePer500m(2000, 480)).toBe(120);
  });

  it("returns zero rather than dividing by zero", () => {
    expect(calcPacePer500m(0, 240)).toBe(0);
  });
});

describe("strokeRateLabel", () => {
  it("bands stroke rate", () => {
    expect(strokeRateLabel(40)).toBe("Low");
    expect(strokeRateLabel(60)).toBe("Medium");
    expect(strokeRateLabel(75)).toBe("High");
    expect(strokeRateLabel(90)).toBe("Sprint");
  });

  it("puts each boundary in the higher band", () => {
    expect(strokeRateLabel(50)).toBe("Medium");
    expect(strokeRateLabel(70)).toBe("High");
    expect(strokeRateLabel(85)).toBe("Sprint");
  });
});

describe("rpeLabel", () => {
  it("bands perceived exertion across the full scale", () => {
    expect(rpeLabel(1)).toBe("Easy");
    expect(rpeLabel(3)).toBe("Easy");
    expect(rpeLabel(5)).toBe("Moderate");
    expect(rpeLabel(7)).toBe("Hard");
    expect(rpeLabel(9)).toBe("Very Hard");
    expect(rpeLabel(10)).toBe("Max");
  });
});

describe("rpeColor", () => {
  it("returns a colour for every point on the scale", () => {
    for (let rpe = 1; rpe <= 10; rpe++) {
      expect(rpeColor(rpe)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("gets redder as effort climbs", () => {
    expect(rpeColor(2)).not.toBe(rpeColor(6));
    expect(rpeColor(10)).toBe("#EF4444");
  });
});

describe("parseSplit", () => {
  it("reads the m:ss an erg monitor displays", () => {
    expect(parseSplit("1:58")).toBe(118);
    expect(parseSplit("2:05")).toBe(125);
    expect(parseSplit("0:45")).toBe(45);
  });

  it("also accepts raw seconds", () => {
    expect(parseSplit("118")).toBe(118);
    expect(parseSplit("118.5")).toBe(118.5);
  });

  it("tolerates surrounding spaces", () => {
    expect(parseSplit("  1:58 ")).toBe(118);
  });

  it("returns null for an empty or unfinished entry", () => {
    expect(parseSplit("")).toBeNull();
    expect(parseSplit("   ")).toBeNull();
    expect(parseSplit("1:")).toBeNull();
    expect(parseSplit(":58")).toBe(58);
  });

  it("rejects nonsense rather than guessing", () => {
    // A wrong split silently poisons the coach's fade analysis.
    expect(parseSplit("abc")).toBeNull();
    expect(parseSplit("1:75")).toBeNull();
    expect(parseSplit("-2:00")).toBeNull();
    expect(parseSplit("0")).toBeNull();
    expect(parseSplit("0:00")).toBeNull();
  });
});
