/**
 * Unit tests for the sync-queue retry policy.
 *
 * This is the path an athlete's logged session takes from their phone to the
 * database. A stuck queue looks, from their side, like the app simply forgot
 * the session — so the failure modes matter more than the happy path.
 */
import { describe, it, expect } from "vitest";
import {
  backoffMs,
  isDue,
  isExhausted,
  classifyFailure,
  describeError,
  onFailure,
  nextDueIn,
  MAX_RETRIES,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
} from "../retry-policy";

const NOW = 1_800_000_000_000;

// ── Backoff ──────────────────────────────────────────────────────────────────

describe("backoffMs", () => {
  it("is immediate for something never attempted", () => {
    expect(backoffMs(0)).toBe(0);
  });

  it("doubles with each failure", () => {
    expect(backoffMs(1)).toBe(BASE_BACKOFF_MS);
    expect(backoffMs(2)).toBe(BASE_BACKOFF_MS * 2);
    expect(backoffMs(3)).toBe(BASE_BACKOFF_MS * 4);
  });

  it("caps rather than growing without bound", () => {
    expect(backoffMs(50)).toBe(MAX_BACKOFF_MS);
    expect(backoffMs(MAX_RETRIES)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
  });

  it("treats nonsense as immediate rather than returning NaN", () => {
    expect(backoffMs(NaN)).toBe(0);
    expect(backoffMs(-3)).toBe(0);
    expect(backoffMs(Infinity)).toBe(0);
  });
});

// ── Due-ness ─────────────────────────────────────────────────────────────────

describe("isDue", () => {
  it("attempts a fresh item straight away", () => {
    expect(isDue({ retries: 0 }, NOW)).toBe(true);
    expect(isDue({}, NOW)).toBe(true);
  });

  it("holds a recently failed item back", () => {
    // Regression: with no backoff at all, this retried on every flush — and
    // flush runs on every write, every mount and every online event.
    expect(isDue({ retries: 1, lastAttemptAt: NOW }, NOW)).toBe(false);
    expect(isDue({ retries: 1, lastAttemptAt: NOW }, NOW + 1000)).toBe(false);
  });

  it("releases it once the backoff has elapsed", () => {
    expect(isDue({ retries: 1, lastAttemptAt: NOW }, NOW + BASE_BACKOFF_MS)).toBe(true);
    expect(isDue({ retries: 2, lastAttemptAt: NOW }, NOW + BASE_BACKOFF_MS * 2)).toBe(true);
  });

  it("never retries an item already marked failed", () => {
    expect(isDue({ retries: 0, failed: 1 }, NOW)).toBe(false);
    expect(isDue({ retries: 1, lastAttemptAt: 0, failed: 1 }, NOW)).toBe(false);
  });

  it("copes with a missing lastAttemptAt", () => {
    expect(isDue({ retries: 3 }, NOW)).toBe(true);
  });

  it("handles rows queued before these fields existed", () => {
    // Items already in an installed user's IndexedDB have `retries` but no
    // `failed` or `lastAttemptAt`. They must be attempted, not skipped.
    const legacy = { retries: 3 };
    expect(isDue(legacy, NOW)).toBe(true);
    expect(isExhausted(legacy)).toBe(false);
    const after = onFailure(legacy, new Error("net"), NOW);
    expect(after.retries).toBe(4);
    expect(after.lastAttemptAt).toBe(NOW);
    // And from then on it backs off normally.
    expect(isDue({ retries: after.retries, lastAttemptAt: after.lastAttemptAt }, NOW)).toBe(false);
  });
});

describe("isExhausted", () => {
  it("is false until the cap is reached", () => {
    expect(isExhausted({ retries: 0 })).toBe(false);
    expect(isExhausted({ retries: MAX_RETRIES - 1 })).toBe(false);
  });

  it("is true at and beyond the cap", () => {
    expect(isExhausted({ retries: MAX_RETRIES })).toBe(true);
    expect(isExhausted({ retries: MAX_RETRIES + 5 })).toBe(true);
  });

  it("treats a missing counter as zero", () => {
    expect(isExhausted({})).toBe(false);
  });
});

// ── Error classification ─────────────────────────────────────────────────────

describe("classifyFailure", () => {
  it("calls integrity and data violations permanent", () => {
    // These fail identically however often they're repeated.
    expect(classifyFailure({ code: "23505" })).toBe("permanent"); // unique violation
    expect(classifyFailure({ code: "23503" })).toBe("permanent"); // FK violation
    expect(classifyFailure({ code: "22P02" })).toBe("permanent"); // invalid text repr
    expect(classifyFailure({ code: "42501" })).toBe("permanent"); // insufficient privilege
  });

  it("calls client errors permanent", () => {
    expect(classifyFailure({ status: 400 })).toBe("permanent");
    expect(classifyFailure({ status: 403 })).toBe("permanent");
    expect(classifyFailure({ status: 422 })).toBe("permanent");
  });

  it("retries timeouts and rate limits", () => {
    expect(classifyFailure({ status: 408 })).toBe("transient");
    expect(classifyFailure({ status: 429 })).toBe("transient");
  });

  it("retries server errors", () => {
    expect(classifyFailure({ status: 500 })).toBe("transient");
    expect(classifyFailure({ status: 503 })).toBe("transient");
  });

  it("retries network failures with no code at all", () => {
    expect(classifyFailure(new Error("Failed to fetch"))).toBe("transient");
    expect(classifyFailure(undefined)).toBe("transient");
    expect(classifyFailure("offline")).toBe("transient");
  });

  it("defaults to transient on anything unrecognised", () => {
    // Wrongly calling something permanent strands a session forever; wrongly
    // calling it transient just costs a few retries.
    expect(classifyFailure({ code: "99999" })).toBe("transient");
    expect(classifyFailure({ weird: true })).toBe("transient");
  });
});

describe("describeError", () => {
  it("keeps the parts worth diagnosing from", () => {
    const s = describeError({ code: "23505", status: 409, message: "duplicate key" });
    expect(s).toContain("23505");
    expect(s).toContain("409");
    expect(s).toContain("duplicate key");
  });

  it("handles strings, empties and unknowns", () => {
    expect(describeError("boom")).toBe("boom");
    expect(describeError(null)).toBe("unknown error");
    expect(describeError({})).not.toBe("");
  });

  it("truncates so a huge message can't bloat the queue row", () => {
    expect(describeError({ message: "x".repeat(5000) }).length).toBeLessThanOrEqual(300);
  });
});

// ── Failure handling ─────────────────────────────────────────────────────────

describe("onFailure", () => {
  it("counts the attempt and stamps the time", () => {
    const u = onFailure({ retries: 0 }, new Error("net"), NOW);
    expect(u.retries).toBe(1);
    expect(u.lastAttemptAt).toBe(NOW);
    expect(u.failed).toBe(0);
  });

  it("gives up immediately on a permanent failure", () => {
    // No point burning eight retries on a unique-key violation.
    const u = onFailure({ retries: 0 }, { code: "23505" }, NOW);
    expect(u.failed).toBe(1);
    expect(u.retries).toBe(1);
  });

  it("keeps retrying a transient failure until the cap", () => {
    let item = { retries: 0 } as { retries: number; failed?: 0 | 1 };
    for (let i = 0; i < MAX_RETRIES - 1; i++) {
      const u = onFailure(item, new Error("net"), NOW);
      expect(u.failed).toBe(0);
      item = { retries: u.retries, failed: u.failed };
    }
    const last = onFailure(item, new Error("net"), NOW);
    expect(last.retries).toBe(MAX_RETRIES);
    expect(last.failed).toBe(1);
  });

  it("records why it failed", () => {
    const u = onFailure({ retries: 0 }, { code: "23505", message: "duplicate key" }, NOW);
    expect(u.lastError).toContain("duplicate key");
  });

  it("never loses the retry count on a malformed item", () => {
    const u = onFailure({}, new Error("net"), NOW);
    expect(u.retries).toBe(1);
    expect(Number.isFinite(u.retries)).toBe(true);
  });
});

// ── Scheduling ───────────────────────────────────────────────────────────────

describe("nextDueIn", () => {
  it("is null when there's nothing queued", () => {
    expect(nextDueIn([], NOW)).toBeNull();
  });

  it("is zero when something is ready now", () => {
    expect(nextDueIn([{ retries: 0 }], NOW)).toBe(0);
  });

  it("reports the soonest wait across the queue", () => {
    const items = [
      { retries: 3, lastAttemptAt: NOW },
      { retries: 1, lastAttemptAt: NOW },
    ];
    expect(nextDueIn(items, NOW)).toBe(backoffMs(1));
  });

  it("ignores items that have already given up", () => {
    expect(nextDueIn([{ retries: 2, lastAttemptAt: NOW, failed: 1 }], NOW)).toBeNull();
  });
});
