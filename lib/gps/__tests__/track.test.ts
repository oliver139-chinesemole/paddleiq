/**
 * Unit tests for GPS track maths.
 *
 * The cases that matter are the dishonest ones: a receiver sitting still must
 * not accumulate distance, and a single bad fix between two good ones must not
 * add phantom kilometres in both directions. Consumer GPS produces both
 * routinely, so filtering is the feature.
 */
import { describe, it, expect } from "vitest";
import {
  haversineM,
  speedKmhBetween,
  filterFixes,
  summarise,
  toPolyline,
  MAX_ACCURACY_M,
  MAX_SPEED_KMH,
  type Fix,
} from "../track";

const T0 = 1_800_000_000_000;

const fix = (lat: number, lon: number, tSec: number, accuracy = 5): Fix => ({
  lat, lon, accuracy, t: T0 + tSec * 1000,
});

/** Roughly 111,320m per degree of latitude, so this is a metres-north helper. */
const north = (metres: number) => metres / 111_320;

// ── Distance ─────────────────────────────────────────────────────────────────

describe("haversineM", () => {
  it("is zero for the same point", () => {
    expect(haversineM(fix(37.87, -122.3, 0), fix(37.87, -122.3, 1))).toBeCloseTo(0, 6);
  });

  it("measures a known north-south distance", () => {
    // One degree of latitude is ~111.3km anywhere on Earth.
    const d = haversineM(fix(37, -122, 0), fix(38, -122, 1));
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("measures a short hop accurately", () => {
    const d = haversineM(fix(37.87, -122.3, 0), fix(37.87 + north(100), -122.3, 1));
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
  });

  it("is symmetric", () => {
    const a = fix(37.8, -122.3, 0), b = fix(37.9, -122.4, 1);
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });

  it("handles crossing the equator and the meridian", () => {
    expect(haversineM(fix(-0.001, -0.001, 0), fix(0.001, 0.001, 1))).toBeGreaterThan(0);
  });
});

describe("speedKmhBetween", () => {
  it("computes speed from distance and elapsed time", () => {
    // 100m in 20s = 5 m/s = 18 km/h
    const s = speedKmhBetween(fix(37.87, -122.3, 0), fix(37.87 + north(100), -122.3, 20));
    expect(s).toBeGreaterThan(17.5);
    expect(s).toBeLessThan(18.5);
  });

  it("returns zero rather than dividing by zero", () => {
    expect(speedKmhBetween(fix(37.87, -122.3, 5), fix(37.88, -122.3, 5))).toBe(0);
  });
});

// ── Filtering ────────────────────────────────────────────────────────────────

describe("filterFixes", () => {
  it("keeps a clean track intact", () => {
    const track = [0, 1, 2, 3].map((i) => fix(37.87 + north(i * 20), -122.3, i * 5));
    expect(filterFixes(track).kept).toHaveLength(4);
  });

  it("drops fixes too imprecise to trust", () => {
    const track = [
      fix(37.87, -122.3, 0, 5),
      fix(37.87 + north(20), -122.3, 5, MAX_ACCURACY_M + 50),
      fix(37.87 + north(40), -122.3, 10, 5),
    ];
    const { kept } = filterFixes(track);
    expect(kept).toHaveLength(2);
  });

  it("discards a jump no boat could make", () => {
    // A fix 5km away one second later is the receiver, not the paddler.
    const track = [
      fix(37.87, -122.3, 0),
      fix(37.87 + north(5000), -122.3, 1),
      fix(37.87 + north(20), -122.3, 5),
    ];
    const { kept } = filterFixes(track);
    expect(kept.map((f) => f.t)).toEqual([T0, T0 + 5000]);
  });

  it("ignores the wander of a stationary receiver", () => {
    // Sitting on the dock: sub-metre drift that must not become distance.
    const track = Array.from({ length: 20 }, (_, i) =>
      fix(37.87 + north((i % 2) * 0.5), -122.3, i * 3)
    );
    expect(filterFixes(track).kept).toHaveLength(1);
  });

  it("drops out-of-order and duplicate timestamps", () => {
    const track = [
      fix(37.87, -122.3, 10),
      fix(37.87 + north(20), -122.3, 5),
      fix(37.87 + north(40), -122.3, 10),
    ];
    expect(filterFixes(track).kept).toHaveLength(1);
  });

  it("rejects impossible coordinates", () => {
    const track = [fix(200, -122.3, 0), fix(37.87, -400, 1), fix(NaN, -122.3, 2)];
    expect(filterFixes(track).kept).toHaveLength(0);
  });

  it("counts what it threw away", () => {
    const track = [fix(37.87, -122.3, 0), fix(37.87, -122.3, 1, 500)];
    expect(filterFixes(track).rejected).toBe(1);
  });

  it("handles an empty track", () => {
    expect(filterFixes([])).toEqual({ kept: [], rejected: 0 });
  });
});

// ── Summary ──────────────────────────────────────────────────────────────────

describe("summarise", () => {
  /** 500m due north over 120s — a 2:00/500m piece. */
  const piece = (): Fix[] =>
    Array.from({ length: 25 }, (_, i) => fix(37.87 + north(i * 20), -122.3, i * 5));

  it("measures distance over a straight piece", () => {
    const s = summarise(piece());
    expect(s.distanceM).toBeGreaterThan(470);
    expect(s.distanceM).toBeLessThan(490);
  });

  it("reports pace in seconds per 500m", () => {
    const s = summarise(piece());
    expect(s.pacePer500Sec).toBeGreaterThan(110);
    expect(s.pacePer500Sec).toBeLessThan(135);
  });

  it("computes average and max speed", () => {
    const s = summarise(piece());
    expect(s.avgSpeedKmh).toBeGreaterThan(12);
    expect(s.avgSpeedKmh).toBeLessThan(16);
    expect(s.maxSpeedKmh).toBeGreaterThanOrEqual(s.avgSpeedKmh - 0.5);
    expect(s.maxSpeedKmh).toBeLessThan(MAX_SPEED_KMH);
  });

  it("separates moving time from elapsed time", () => {
    // Paddle, drift for a minute, paddle again.
    const track = [
      ...Array.from({ length: 10 }, (_, i) => fix(37.87 + north(i * 20), -122.3, i * 5)),
      fix(37.87 + north(180), -122.3, 110),
      ...Array.from({ length: 10 }, (_, i) => fix(37.87 + north(200 + i * 20), -122.3, 120 + i * 5)),
    ];
    const s = summarise(track);
    expect(s.movingSec).toBeLessThan(s.durationSec);
    expect(s.movingSec).toBeGreaterThan(0);
  });

  it("reports nothing for a paddler who never moved", () => {
    // Regression: unfiltered, receiver drift alone accumulates distance.
    const still = Array.from({ length: 60 }, (_, i) =>
      fix(37.87 + north((i % 3) * 0.4), -122.3, i * 2)
    );
    const s = summarise(still);
    expect(s.distanceM).toBe(0);
    expect(s.pacePer500Sec).toBe(0);
  });

  it("isn't fooled by a single bad fix mid-track", () => {
    // A 3km jump and back would otherwise add 6km of phantom distance.
    const clean = summarise(piece());
    const withGlitch = [...piece()];
    withGlitch.splice(12, 0, fix(37.87 + north(3000), -122.3, 61));
    const dirty = summarise(withGlitch);
    expect(dirty.distanceM).toBeCloseTo(clean.distanceM, 0);
    expect(dirty.rejectedFixes).toBeGreaterThan(0);
  });

  it("returns zeroes rather than NaN for a too-short track", () => {
    for (const track of [[], [fix(37.87, -122.3, 0)]]) {
      const s = summarise(track);
      expect(s.distanceM).toBe(0);
      expect(Number.isFinite(s.pacePer500Sec)).toBe(true);
      expect(Number.isFinite(s.avgSpeedKmh)).toBe(true);
    }
  });
});

// ── Drawing ──────────────────────────────────────────────────────────────────

describe("toPolyline", () => {
  const straight = () =>
    Array.from({ length: 10 }, (_, i) => fix(37.87 + north(i * 30), -122.3, i * 5));

  it("returns a point per kept fix", () => {
    expect(toPolyline(straight())).toHaveLength(10);
  });

  it("keeps every point inside the unit square", () => {
    for (const p of toPolyline(straight())) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("puts north at the top", () => {
    // Canvas y grows downward, so a northward track must end higher up.
    const pts = toPolyline(straight());
    expect(pts[pts.length - 1].y).toBeLessThan(pts[0].y);
  });

  it("preserves proportions rather than stretching to fill", () => {
    // A straight north-south line should stay a line, not spread sideways.
    const pts = toPolyline(straight());
    const xs = pts.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.01);
  });

  it("returns nothing to draw for a track that never moved", () => {
    expect(toPolyline([fix(37.87, -122.3, 0), fix(37.87, -122.3, 5)])).toEqual([]);
    expect(toPolyline([])).toEqual([]);
  });
});
