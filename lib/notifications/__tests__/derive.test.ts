/**
 * Unit tests for notification derivation.
 * Pure — no DOM, no network.
 */
import { describe, it, expect } from "vitest";
import {
  deriveNotifications,
  unreadCount,
  latestAt,
  MAX_NOTIFICATIONS,
  type AppNotification,
} from "../derive";

const NOW = new Date("2026-06-15T12:00:00");

const d = (daysAgo: number) => {
  const x = new Date(NOW);
  x.setDate(x.getDate() - daysAgo);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const pr = (o: Partial<Parameters<typeof deriveNotifications>[0]["prs"] extends (infer T)[] | undefined ? T : never> = {}) => ({
  id: "pr1", category: "erg", distance_m: 500, time_sec: 118,
  date: d(2), improvement_sec: 4, ...o,
});

// ── PRs ──────────────────────────────────────────────────────────────────────

describe("deriveNotifications — PRs", () => {
  it("surfaces a recent PR", () => {
    const [n] = deriveNotifications({ prs: [pr()] }, NOW);
    expect(n.kind).toBe("pr");
    expect(n.title).toContain("500m");
    expect(n.body).toContain("4.0s faster");
    expect(n.href).toBe("/records");
  });

  it("labels kilometre distances", () => {
    const [n] = deriveNotifications({ prs: [pr({ distance_m: 2000, time_sec: 512 })] }, NOW);
    expect(n.title).toContain("2k");
    expect(n.body).toContain("8:32");
  });

  it("copes with no improvement figure", () => {
    const [n] = deriveNotifications({ prs: [pr({ improvement_sec: null })] }, NOW);
    expect(n.body).not.toMatch(/NaN|null|undefined/);
  });

  it("drops PRs older than the lookback window", () => {
    expect(deriveNotifications({ prs: [pr({ date: d(30) })] }, NOW)).toHaveLength(0);
  });

  it("ignores future-dated PRs", () => {
    expect(deriveNotifications({ prs: [pr({ date: d(-5) })] }, NOW)).toHaveLength(0);
  });
});

// ── Assignments ──────────────────────────────────────────────────────────────

describe("deriveNotifications — assignments", () => {
  it("surfaces an outstanding assignment", () => {
    const [n] = deriveNotifications({
      assignments: [{ id: "a1", title: "4x500m intervals", created_at: d(1), target_date: d(-2) }],
    }, NOW);
    expect(n.kind).toBe("assignment");
    expect(n.body).toContain("4x500m intervals");
    expect(n.href).toBe("/train");
  });

  it("stays quiet about work already done", () => {
    expect(deriveNotifications({
      assignments: [{ id: "a1", title: "Done", created_at: d(1), completed: true }],
    }, NOW)).toHaveLength(0);
  });

  it("skips an assignment with no dates at all", () => {
    expect(deriveNotifications({
      assignments: [{ id: "a1", title: "Undated" }],
    }, NOW)).toHaveLength(0);
  });

  it("falls back to the due date when there's no created_at", () => {
    const out = deriveNotifications({
      assignments: [{ id: "a1", title: "Erg test", target_date: d(1) }],
    }, NOW);
    expect(out).toHaveLength(1);
  });
});

// ── Announcements ────────────────────────────────────────────────────────────

describe("deriveNotifications — announcements", () => {
  it("attributes the author", () => {
    const [n] = deriveNotifications({
      announcements: [{ id: "f1", content: "Practice at 7am", author_name: "Coach Sarah", created_at: d(1) }],
    }, NOW);
    expect(n.title).toContain("Coach Sarah");
    expect(n.body).toBe("Practice at 7am");
    expect(n.href).toBe("/team");
  });

  it("truncates a long post", () => {
    const [n] = deriveNotifications({
      announcements: [{ content: "x".repeat(300), created_at: d(1) }],
    }, NOW);
    expect(n.body.length).toBeLessThanOrEqual(140);
    expect(n.body.endsWith("…")).toBe(true);
  });

  it("handles a missing author", () => {
    const [n] = deriveNotifications({
      announcements: [{ content: "Notice", created_at: d(1) }],
    }, NOW);
    expect(n.title).toBe("Team announcement");
  });
});

// ── Events ───────────────────────────────────────────────────────────────────

describe("deriveNotifications — events", () => {
  it("announces an upcoming session", () => {
    const [n] = deriveNotifications({
      events: [{ id: "e1", title: "Saturday practice", starts_at: d(-3) }],
    }, NOW);
    expect(n.kind).toBe("event");
    expect(n.body).toContain("Saturday practice");
  });

  it("calls out a race specifically", () => {
    const [n] = deriveNotifications({
      events: [{ id: "e1", title: "Regional heats", event_type: "race", starts_at: d(-2) }],
    }, NOW);
    expect(n.title).toMatch(/race/i);
  });

  it("ignores events that have already happened", () => {
    expect(deriveNotifications({
      events: [{ title: "Last week", starts_at: d(3) }],
    }, NOW)).toHaveLength(0);
  });

  it("ignores events beyond the horizon", () => {
    expect(deriveNotifications({
      events: [{ title: "Next month", starts_at: d(-40) }],
    }, NOW)).toHaveLength(0);
  });
});

// ── Feed behaviour ───────────────────────────────────────────────────────────

describe("deriveNotifications — feed", () => {
  it("returns nothing for empty sources", () => {
    expect(deriveNotifications({}, NOW)).toEqual([]);
    expect(deriveNotifications({ prs: [], announcements: [] }, NOW)).toEqual([]);
  });

  it("orders newest first across kinds", () => {
    const out = deriveNotifications({
      prs: [pr({ id: "old", date: d(5) })],
      announcements: [{ id: "new", content: "Latest", created_at: d(0) }],
      assignments: [{ id: "mid", title: "Mid", created_at: d(2) }],
    }, NOW);
    expect(out.map((n) => n.id)).toEqual(["new", "mid", "old"]);
  });

  it("caps the feed length", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `a${i}`, content: `Post ${i}`, created_at: d(i % 10),
    }));
    expect(deriveNotifications({ announcements: many }, NOW).length).toBe(MAX_NOTIFICATIONS);
  });

  it("gives every item a stable id, title, body and link", () => {
    const out = deriveNotifications({
      prs: [pr()],
      announcements: [{ content: "Notice", created_at: d(1) }],
      assignments: [{ title: "Work", created_at: d(1) }],
      events: [{ title: "Race", starts_at: d(-1) }],
    }, NOW);
    expect(out).toHaveLength(4);
    const ids = out.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of out) {
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.body.length).toBeGreaterThan(0);
      expect(n.href.startsWith("/")).toBe(true);
      expect(Number.isFinite(n.at)).toBe(true);
    }
  });
});

// ── Unread ───────────────────────────────────────────────────────────────────

describe("unreadCount", () => {
  const NOW_MS = NOW.getTime();
  const feed = (): AppNotification[] => deriveNotifications({
    prs: [pr({ id: "p", date: d(1) })],
    announcements: [{ id: "a", content: "Newer", created_at: d(0) }],
  }, NOW);

  it("counts everything when nothing has been seen", () => {
    expect(unreadCount(feed(), 0, NOW_MS)).toBe(2);
  });

  it("counts nothing once the feed has been read", () => {
    const items = feed();
    expect(unreadCount(items, latestAt(items), NOW_MS)).toBe(0);
  });

  it("counts only what arrived since the last visit", () => {
    const items = feed();
    const oldest = Math.min(...items.map((n) => n.at));
    expect(unreadCount(items, oldest, NOW_MS)).toBe(1);
  });

  it("never counts an upcoming event as unread", () => {
    // Regression: an event is timestamped with when it starts, so a future one
    // stayed unread on every load and the dot never cleared.
    const items = deriveNotifications({
      events: [{ id: "e", title: "Saturday practice", starts_at: d(-3) }],
    }, NOW);
    expect(items).toHaveLength(1);
    expect(unreadCount(items, 0, NOW_MS)).toBe(0);
  });

  it("still counts past items alongside an upcoming event", () => {
    const items = deriveNotifications({
      events: [{ id: "e", title: "Saturday practice", starts_at: d(-3) }],
      announcements: [{ id: "a", content: "Posted yesterday", created_at: d(1) }],
    }, NOW);
    expect(items).toHaveLength(2);
    expect(unreadCount(items, 0, NOW_MS)).toBe(1);
  });

  it("clears once read, and stays clear on a later load", () => {
    const items = deriveNotifications({
      events: [{ id: "e", title: "Saturday practice", starts_at: d(-3) }],
      announcements: [{ id: "a", content: "Posted yesterday", created_at: d(1) }],
    }, NOW);
    const seenAt = NOW_MS;
    expect(unreadCount(items, seenAt, NOW_MS)).toBe(0);
    // An hour later, nothing new has arrived.
    expect(unreadCount(items, seenAt, NOW_MS + 3600_000)).toBe(0);
  });

  it("is zero for an empty feed, whatever the marker", () => {
    expect(unreadCount([], 0, NOW_MS)).toBe(0);
    expect(latestAt([])).toBe(0);
  });
});
