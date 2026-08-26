import { describe, it, expect } from "vitest";
import {
  predictTime,
  confidenceFor,
  bestAnchor,
  fitEnduranceProfile,
  leanFor,
  predictMissing,
  findProfileGaps,
  DEFAULT_EXPONENT,
  type RacePoint,
} from "../race";

/** A 2k in 8:00 — a round, realistic anchor. */
const pr2k: RacePoint = { distance_m: 2000, time_sec: 480 };

describe("predictTime", () => {
  it("returns the same time for the same distance", () => {
    expect(predictTime(pr2k, 2000)).toBe(480);
  });

  it("reproduces the 5-seconds-per-double split rule", () => {
    // This is the check that the default exponent is right for the sport:
    // coaches say doubling the distance costs about 5s on the 500m split.
    // 2k at 8:00 is a 2:00 split; the 4k prediction should be about 2:05.
    const t4k = predictTime(pr2k, 4000)!;
    const split4k = (t4k / 4000) * 500;
    expect(split4k - 120).toBeGreaterThan(4);
    expect(split4k - 120).toBeLessThan(6);
  });

  it("holds the rule going down as well as up", () => {
    const t1k = predictTime(pr2k, 1000)!;
    const split1k = (t1k / 1000) * 500;
    expect(120 - split1k).toBeGreaterThan(4);
    expect(120 - split1k).toBeLessThan(6);
  });

  it("predicts a slower split over a longer distance", () => {
    const t500 = predictTime(pr2k, 500)!;
    const t5k = predictTime(pr2k, 5000)!;
    expect((t500 / 500) * 500).toBeLessThan((t5k / 5000) * 500);
  });

  it("honours a personalised exponent", () => {
    // A lower exponent means less fade, so a longer prediction comes in faster.
    const strong = predictTime(pr2k, 5000, 0.98)!;
    const typical = predictTime(pr2k, 5000, DEFAULT_EXPONENT)!;
    expect(strong).toBeLessThan(typical);
  });

  it("rejects nonsense rather than returning NaN", () => {
    // These reach the UI as "NaN:aN" if they slip through.
    expect(predictTime({ distance_m: 0, time_sec: 480 }, 2000)).toBeNull();
    expect(predictTime({ distance_m: 2000, time_sec: 0 }, 2000)).toBeNull();
    expect(predictTime(pr2k, 0)).toBeNull();
    expect(predictTime(pr2k, -500)).toBeNull();
    expect(predictTime(pr2k, 2000, 0)).toBeNull();
    expect(predictTime(pr2k, 2000, NaN)).toBeNull();
  });
});

describe("confidenceFor", () => {
  it("is confident near the anchor", () => {
    expect(confidenceFor(2000, 1000)).toBe("high");
    expect(confidenceFor(2000, 4000)).toBe("high");
  });

  it("softens as the reach grows", () => {
    expect(confidenceFor(2000, 500)).toBe("moderate");
    expect(confidenceFor(2000, 8000)).toBe("moderate");
  });

  it("admits a long extrapolation is rough", () => {
    expect(confidenceFor(500, 5000)).toBe("rough");
    expect(confidenceFor(10000, 500)).toBe("rough");
  });

  it("is symmetric — direction doesn't change how far the reach is", () => {
    expect(confidenceFor(500, 2000)).toBe(confidenceFor(2000, 500));
  });
});

describe("bestAnchor", () => {
  const prs: RacePoint[] = [
    { distance_m: 500, time_sec: 105 },
    { distance_m: 2000, time_sec: 480 },
    { distance_m: 5000, time_sec: 1280 },
  ];

  it("picks the nearest distance in ratio", () => {
    expect(bestAnchor(prs, 1000)?.distance_m).toBe(2000);
    expect(bestAnchor(prs, 6000)?.distance_m).toBe(5000);
    expect(bestAnchor(prs, 400)?.distance_m).toBe(500);
  });

  it("measures nearness in ratio, not raw metres", () => {
    // 250m is 250m from 500 and 1750m from 2000, but in ratio terms it is a
    // 2x reach either way — and 2000 is the more informative effort.
    const twoWay: RacePoint[] = [
      { distance_m: 500, time_sec: 105 },
      { distance_m: 2000, time_sec: 480 },
    ];
    expect(bestAnchor(twoWay, 1000)?.distance_m).toBe(2000);
  });

  it("prefers the longer effort on a tie", () => {
    const tied: RacePoint[] = [
      { distance_m: 1000, time_sec: 230 },
      { distance_m: 4000, time_sec: 1000 },
    ];
    expect(bestAnchor(tied, 2000)?.distance_m).toBe(4000);
  });

  it("ignores unusable entries", () => {
    const withJunk: RacePoint[] = [
      { distance_m: 1000, time_sec: 0 },
      { distance_m: 2000, time_sec: 480 },
    ];
    expect(bestAnchor(withJunk, 1000)?.distance_m).toBe(2000);
  });

  it("returns null when there is nothing to anchor on", () => {
    expect(bestAnchor([], 2000)).toBeNull();
    expect(bestAnchor(prs, 0)).toBeNull();
  });
});

describe("fitEnduranceProfile", () => {
  it("recovers the exponent from data generated with it", () => {
    // Points built with k = 1.10 exactly; the fit should find it back.
    const k = 1.1;
    const prs: RacePoint[] = [500, 1000, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, k),
    }));

    const profile = fitEnduranceProfile(prs);
    expect(profile.fitted).toBe(true);
    expect(profile.exponent).toBeCloseTo(k, 3);
    expect(profile.r2).toBeGreaterThan(0.999);
    expect(profile.points).toBe(4);
  });

  it("falls back to the generic exponent below three PRs", () => {
    const profile = fitEnduranceProfile([pr2k, { distance_m: 500, time_sec: 105 }]);
    expect(profile.fitted).toBe(false);
    expect(profile.exponent).toBe(DEFAULT_EXPONENT);
  });

  it("falls back when every PR is at the same distance", () => {
    const profile = fitEnduranceProfile([
      { distance_m: 2000, time_sec: 480 },
      { distance_m: 2000, time_sec: 484 },
      { distance_m: 2000, time_sec: 490 },
    ]);
    expect(profile.fitted).toBe(false);
  });

  it("keeps only the fastest result at each distance", () => {
    // A slow repeat shouldn't tilt the slope; it isn't a PR.
    const clean: RacePoint[] = [
      { distance_m: 500, time_sec: 105 },
      { distance_m: 2000, time_sec: 480 },
      { distance_m: 5000, time_sec: 1280 },
    ];
    const withSlowRepeat = [...clean, { distance_m: 2000, time_sec: 620 }];
    expect(fitEnduranceProfile(withSlowRepeat).exponent).toBeCloseTo(
      fitEnduranceProfile(clean).exponent,
      6,
    );
  });

  it("refuses a fit the PRs don't actually support", () => {
    // Scattered times — no consistent profile to read off them.
    const noisy: RacePoint[] = [
      { distance_m: 500, time_sec: 200 },
      { distance_m: 1000, time_sec: 210 },
      { distance_m: 2000, time_sec: 205 },
      { distance_m: 5000, time_sec: 900 },
    ];
    const profile = fitEnduranceProfile(noisy);
    expect(profile.fitted).toBe(false);
    expect(profile.exponent).toBe(DEFAULT_EXPONENT);
  });

  it("refuses an exponent no human produces", () => {
    // A mistyped 5k (12:00 instead of 21:20) fits tightly but implies k ≈ 0.5.
    const typo: RacePoint[] = [
      { distance_m: 500, time_sec: 105 },
      { distance_m: 2000, time_sec: 210 },
      { distance_m: 5000, time_sec: 330 },
    ];
    const profile = fitEnduranceProfile(typo);
    expect(profile.fitted).toBe(false);
    expect(profile.exponent).toBe(DEFAULT_EXPONENT);
  });

  it("labels a low exponent as an endurance profile", () => {
    const prs: RacePoint[] = [500, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, 0.98),
    }));
    expect(fitEnduranceProfile(prs).lean).toBe("endurance");
  });

  it("labels a high exponent as a speed profile", () => {
    const prs: RacePoint[] = [500, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, 1.18),
    }));
    expect(fitEnduranceProfile(prs).lean).toBe("speed");
  });

  it("calls a typical exponent balanced", () => {
    expect(leanFor(DEFAULT_EXPONENT)).toBe("balanced");
    expect(leanFor(1.04)).toBe("balanced");
  });

  it("handles no PRs at all", () => {
    const profile = fitEnduranceProfile([]);
    expect(profile.fitted).toBe(false);
    expect(profile.points).toBe(0);
  });
});

describe("predictMissing", () => {
  const prs: RacePoint[] = [
    { distance_m: 500, time_sec: 105 },
    { distance_m: 2000, time_sec: 480 },
  ];

  it("predicts only the distances with no PR", () => {
    const out = predictMissing(prs, [500, 1000, 2000, 5000]);
    expect(out.map((p) => p.distance_m)).toEqual([1000, 5000]);
  });

  it("reports the split as well as the time", () => {
    const [oneK] = predictMissing(prs, [1000]);
    expect(oneK.split_sec).toBe(Math.round((oneK.time_sec / 1000) * 500));
  });

  it("says which PR it extrapolated from", () => {
    const [fiveK] = predictMissing(prs, [5000]);
    expect(fiveK.from.distance_m).toBe(2000);
    expect(fiveK.confidence).toBe("moderate");
  });

  it("returns nothing when there are no PRs to work from", () => {
    expect(predictMissing([], [1000, 2000])).toEqual([]);
  });

  it("returns nothing when every distance is already covered", () => {
    expect(predictMissing(prs, [500, 2000])).toEqual([]);
  });

  it("comes back sorted by distance", () => {
    const out = predictMissing(prs, [5000, 1000, 10000]);
    expect(out.map((p) => p.distance_m)).toEqual([1000, 5000, 10000]);
  });
});

describe("findProfileGaps", () => {
  it("finds the distance that lags the rest", () => {
    // Consistent profile, except the 500m is 15% off the pace it implies.
    const k = 1.06;
    const prs: RacePoint[] = [1000, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, k),
    }));
    prs.push({ distance_m: 500, time_sec: 480 * Math.pow(0.25, k) * 1.15 });

    const [worst] = findProfileGaps(prs);
    expect(worst.distance_m).toBe(500);
    expect(worst.delta_pct).toBeGreaterThan(10);
    expect(worst.delta_sec).toBeGreaterThan(0);
  });

  it("holds each PR out of its own prediction", () => {
    // If the outlier were allowed into the fit it would drag the baseline
    // toward itself and its gap would shrink toward nothing.
    const prs: RacePoint[] = [1000, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, 1.06),
    }));
    prs.push({ distance_m: 500, time_sec: 480 * Math.pow(0.25, 1.06) * 1.2 });

    const gap = findProfileGaps(prs).find((g) => g.distance_m === 500)!;
    expect(gap.delta_pct).toBeGreaterThan(15);
  });

  it("reports near-zero gaps for a consistent athlete", () => {
    const prs: RacePoint[] = [500, 1000, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, 1.06),
    }));
    for (const gap of findProfileGaps(prs)) {
      expect(Math.abs(gap.delta_pct)).toBeLessThan(1);
    }
  });

  it("orders weakest first", () => {
    const prs: RacePoint[] = [1000, 2000, 5000].map((d) => ({
      distance_m: d,
      time_sec: 480 * Math.pow(d / 2000, 1.06),
    }));
    prs.push({ distance_m: 500, time_sec: 480 * Math.pow(0.25, 1.06) * 1.15 });

    const gaps = findProfileGaps(prs);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].delta_pct).toBeGreaterThanOrEqual(gaps[i].delta_pct);
    }
  });

  it("stays silent with too few PRs to hold one out", () => {
    expect(findProfileGaps([pr2k])).toEqual([]);
    expect(findProfileGaps([pr2k, { distance_m: 500, time_sec: 105 }])).toEqual([]);
  });

  it("survives PRs at a single distance", () => {
    expect(() =>
      findProfileGaps([
        { distance_m: 2000, time_sec: 480 },
        { distance_m: 2000, time_sec: 485 },
        { distance_m: 2000, time_sec: 490 },
      ]),
    ).not.toThrow();
  });

  it("ignores unusable entries instead of producing NaN", () => {
    const gaps = findProfileGaps([
      { distance_m: 500, time_sec: 105 },
      { distance_m: 1000, time_sec: 230 },
      { distance_m: 2000, time_sec: 480 },
      { distance_m: 5000, time_sec: 0 },
    ]);
    for (const g of gaps) {
      expect(Number.isFinite(g.delta_pct)).toBe(true);
      expect(Number.isFinite(g.delta_sec)).toBe(true);
    }
  });
});
