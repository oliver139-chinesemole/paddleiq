// @vitest-environment jsdom
/**
 * Integration tests for the session write path, against a real IndexedDB
 * implementation via fake-indexeddb.
 *
 * This is how every session an athlete logs reaches storage: written to Dexie
 * immediately, then queued for Supabase. It had no tests at all, which is
 * uncomfortable for the one path where a bug means a lost training session.
 *
 * These exercise Dexie for real rather than mocking it — the interesting
 * failures here are ordering and indexing behaviour, which a mock would just
 * reimplement incorrectly.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";

// enqueue() fires a flush at Supabase; the queue rows are what we care about.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    throw new Error("network disabled in tests");
  },
}));

import {
  saveErgSession, getErgSessions,
  saveWaterSession, getWaterSessions,
  saveTeamSession, getTeamSessions,
  saveDrylandSession, getDrylandSessions,
  getAllSessionsForUser,
} from "../sessions";
import { getLocalDB } from "../schema";

const USER = "athlete-1";
const OTHER = "athlete-2";

const erg = (date: string, userId = USER) => ({
  userId, user_id: userId, date,
  distance_m: 2000, duration_sec: 480, split_sec: 120, stroke_rate: 70,
  rpe: 6, paddle_side: "left" as const, workout_type: "steady" as const,
  created_at: `${date}T10:00:00Z`,
});

const water = (date: string, userId = USER) => ({
  userId, user_id: userId, date,
  distance_m: 5000, duration_sec: 1800, avg_pace_sec: 180,
  avg_speed_kmh: 10, max_speed_kmh: 12, rpe: 6, boat_type: "oc1",
  water_condition: "flat" as const,
  created_at: `${date}T10:00:00Z`,
});

const team = (date: string, userId = USER) => ({
  userId, user_id: userId, team_id: "t1", date,
  duration_min: 90, distance_m: 8000, practice_type: "endurance" as const,
  paddle_side: "left" as const, role_in_boat: "paddler" as const,
  created_at: `${date}T10:00:00Z`,
});

const dryland = (date: string, userId = USER) => ({
  userId, user_id: userId, date,
  duration_min: 45, exercises: [], rpe: 6, created_at: `${date}T10:00:00Z`,
});

beforeEach(async () => {
  const db = getLocalDB();
  await Promise.all([
    db.ergSessions.clear(), db.waterSessions.clear(),
    db.teamSessions.clear(), db.drylandSessions.clear(),
    db.syncQueue.clear(),
  ]);
});

// ── Writing ──────────────────────────────────────────────────────────────────

describe("saving a session", () => {
  it("stores it locally and returns its id", async () => {
    const id = await saveErgSession(erg("2026-06-10"));
    expect(typeof id).toBe("number");

    const rows = await getErgSessions(USER);
    expect(rows).toHaveLength(1);
    expect(rows[0].distance_m).toBe(2000);
  });

  it("marks it unsynced so the queue knows to send it", async () => {
    await saveErgSession(erg("2026-06-10"));
    const [row] = await getErgSessions(USER);
    expect(row.synced).toBe(0);
  });

  it("queues it for the server", async () => {
    await saveErgSession(erg("2026-06-10"));
    const queued = await getLocalDB().syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].table).toBe("erg_sessions");
    expect(queued[0].operation).toBe("insert");
    expect(queued[0].retries).toBe(0);
  });

  it("ties the queue entry back to the local row", async () => {
    // markLocalSynced parses this to flip synced -> 1, so a mismatch here
    // means rows stay unsynced forever and re-send on every flush.
    const id = await saveErgSession(erg("2026-06-10"));
    const [queued] = await getLocalDB().syncQueue.toArray();
    expect(queued.payload.localId).toBe(String(id));
  });

  it("survives the server being unreachable", async () => {
    // enqueue fires a flush that throws here; the local write must still stand.
    await expect(saveErgSession(erg("2026-06-10"))).resolves.toBeTypeOf("number");
    expect(await getErgSessions(USER)).toHaveLength(1);
  });

  it("handles every session type", async () => {
    await saveErgSession(erg("2026-06-10"));
    await saveWaterSession(water("2026-06-11"));
    await saveTeamSession(team("2026-06-12"));
    await saveDrylandSession(dryland("2026-06-13"));

    expect(await getErgSessions(USER)).toHaveLength(1);
    expect(await getWaterSessions(USER)).toHaveLength(1);
    expect(await getTeamSessions(USER)).toHaveLength(1);
    expect(await getDrylandSessions(USER)).toHaveLength(1);

    const queued = await getLocalDB().syncQueue.toArray();
    expect(queued.map((q) => q.table).sort()).toEqual([
      "dryland_sessions", "erg_sessions", "team_sessions", "water_sessions",
    ]);
  });

  it("keeps repeated sessions on the same day as separate rows", async () => {
    // Double days are real training, not duplicates to collapse.
    await saveErgSession(erg("2026-06-10"));
    await saveErgSession(erg("2026-06-10"));
    expect(await getErgSessions(USER)).toHaveLength(2);
  });
});

// ── Reading ──────────────────────────────────────────────────────────────────

describe("reading sessions back", () => {
  it("returns newest first", async () => {
    await saveErgSession(erg("2026-06-01"));
    await saveErgSession(erg("2026-06-15"));
    await saveErgSession(erg("2026-06-08"));

    const dates = (await getErgSessions(USER)).map((r) => r.date);
    expect(dates).toEqual(["2026-06-15", "2026-06-08", "2026-06-01"]);
  });

  it("never returns another athlete's sessions", async () => {
    // Shared devices are normal in a team; this is the boundary that matters.
    await saveErgSession(erg("2026-06-10", USER));
    await saveErgSession(erg("2026-06-11", OTHER));

    const mine = await getErgSessions(USER);
    expect(mine).toHaveLength(1);
    expect(mine[0].userId).toBe(USER);
  });

  it("returns nothing for an athlete with no history", async () => {
    expect(await getErgSessions("nobody")).toEqual([]);
  });

  it("gathers every modality for the coach engine", async () => {
    await saveErgSession(erg("2026-06-10"));
    await saveWaterSession(water("2026-06-11"));
    await saveTeamSession(team("2026-06-12"));
    await saveDrylandSession(dryland("2026-06-13"));

    const all = await getAllSessionsForUser(USER);
    expect(all.erg).toHaveLength(1);
    expect(all.water).toHaveLength(1);
    expect(all.team).toHaveLength(1);
    expect(all.dryland).toHaveLength(1);
  });

  it("scopes the coach engine gather to one athlete too", async () => {
    await saveErgSession(erg("2026-06-10", USER));
    await saveErgSession(erg("2026-06-10", OTHER));
    await saveWaterSession(water("2026-06-10", OTHER));

    const all = await getAllSessionsForUser(USER);
    expect(all.erg).toHaveLength(1);
    expect(all.water).toHaveLength(0);
  });

  it("returns empty collections rather than throwing on a fresh install", async () => {
    const all = await getAllSessionsForUser("brand-new");
    expect(all).toEqual({ erg: [], water: [], team: [], dryland: [] });
  });
});

// ── Queue integrity ──────────────────────────────────────────────────────────

describe("the sync queue after writes", () => {
  it("queues one entry per saved session, in order", async () => {
    await saveErgSession(erg("2026-06-10"));
    await saveErgSession(erg("2026-06-11"));
    await saveErgSession(erg("2026-06-12"));

    const queued = await getLocalDB().syncQueue.orderBy("createdAt").toArray();
    expect(queued).toHaveLength(3);
    expect(queued.map((q) => q.payload.date)).toEqual([
      "2026-06-10", "2026-06-11", "2026-06-12",
    ]);
  });

  it("gives every entry a unique localId", async () => {
    for (let i = 0; i < 5; i++) await saveErgSession(erg("2026-06-10"));
    const ids = (await getLocalDB().syncQueue.toArray()).map((q) => q.localId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts entries unfailed, so the retry policy sees them", async () => {
    await saveErgSession(erg("2026-06-10"));
    const [q] = await getLocalDB().syncQueue.toArray();
    expect(q.failed).toBe(0);
    expect(q.retries).toBe(0);
  });
});
