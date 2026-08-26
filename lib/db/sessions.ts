"use client";
/**
 * Session write/read helpers.
 * Every write: save to Dexie immediately (optimistic), then enqueue a Supabase sync.
 * Every read: read from Dexie (fast, offline-safe), merged with server rows on reconnect.
 */
import { getLocalDB, type LocalErgSession, type LocalPR, type LocalWaterSession, type LocalTeamSession, type LocalDrylandSession } from "./schema";
import { enqueue } from "./sync";
import { candidateFromSession, evaluateRecord, type PRCategory } from "@/lib/records/detect";
import { bumpDataRevision } from "./revision";

/**
 * Record a personal best if this session set one.
 *
 * Nothing wrote to db.personalRecords before this — four places read it and
 * none filled it — so the Records page was permanently empty for anyone with
 * a real account, however hard they trained.
 *
 * Deliberately not fatal: a session is the thing worth keeping, and a failure
 * to work out a PR must never lose it. Callers await this after the session is
 * already stored.
 */
async function recordPRIfSet(
  userId: string,
  category: PRCategory,
  session: { distance_m?: number; duration_sec?: number; date?: string; workout_type?: string },
): Promise<void> {
  try {
    const candidate = candidateFromSession(category, session);
    if (!candidate) return;

    const db = getLocalDB();
    const existing = await db.personalRecords.where("userId").equals(userId).toArray();
    const update = evaluateRecord(existing, candidate);
    if (!update) return;

    const previous = existing.find(
      (p) => p.category === update.category && p.distance_m === update.distance_m,
    );

    const row: Omit<LocalPR, "localId"> = {
      userId,
      user_id: userId,
      category: update.category,
      distance_m: update.distance_m,
      time_sec: update.time_sec,
      date: update.date,
      previous_time_sec: update.previous_time_sec,
      improvement_sec: update.improvement_sec,
      synced: 0,
    };

    // One row per distance and category: a record is the current best, not a
    // history. Keeping every attempt would make the Records page pick one at
    // random and would break the "how many PRs" count.
    if (previous?.localId !== undefined) {
      await db.personalRecords.update(previous.localId, row);
      await enqueue("personal_records", "update", { ...row, localId: String(previous.localId) });
    } else {
      const id = await db.personalRecords.add(row as LocalPR);
      await enqueue("personal_records", "insert", { ...row, localId: String(id) });
    }
  } catch {
    // Swallowed on purpose — see above. The session is already saved.
  }
}

// ── ErgSessions ────────────────────────────────────────────────────────────

export async function saveErgSession(
  data: Omit<LocalErgSession, "localId" | "synced">,
): Promise<number> {
  const db = getLocalDB();
  const id = await db.ergSessions.add({ ...data, synced: 0 });
  await enqueue("erg_sessions", "insert", { ...data, localId: String(id) });
  await recordPRIfSet(data.userId, "erg", data);
  // Wakes anything mounted that is showing this data — notably the top nav's
  // notification feed, which otherwise reads Dexie once per page load.
  bumpDataRevision();
  return id;
}

export async function getErgSessions(userId: string): Promise<LocalErgSession[]> {
  const db = getLocalDB();
  return db.ergSessions.where("userId").equals(userId).reverse().sortBy("date");
}

// ── WaterSessions ──────────────────────────────────────────────────────────

export async function saveWaterSession(
  data: Omit<LocalWaterSession, "localId" | "synced">,
): Promise<number> {
  const db = getLocalDB();
  const id = await db.waterSessions.add({ ...data, synced: 0 });
  await enqueue("water_sessions", "insert", { ...data, localId: String(id) });
  // Water sessions carry no workout_type; a solo time trial at an exact
  // distance is the equivalent of an erg test here.
  await recordPRIfSet(data.userId, "water", data);
  bumpDataRevision();
  return id;
}

export async function getWaterSessions(userId: string): Promise<LocalWaterSession[]> {
  const db = getLocalDB();
  return db.waterSessions.where("userId").equals(userId).reverse().sortBy("date");
}

// ── TeamSessions ───────────────────────────────────────────────────────────

export async function saveTeamSession(
  data: Omit<LocalTeamSession, "localId" | "synced">,
): Promise<number> {
  const db = getLocalDB();
  const id = await db.teamSessions.add({ ...data, synced: 0 });
  await enqueue("team_sessions", "insert", { ...data, localId: String(id) });
  bumpDataRevision();
  return id;
}

export async function getTeamSessions(userId: string): Promise<LocalTeamSession[]> {
  const db = getLocalDB();
  return db.teamSessions.where("userId").equals(userId).reverse().sortBy("date");
}

// ── DrylandSessions ────────────────────────────────────────────────────────

export async function saveDrylandSession(
  data: Omit<LocalDrylandSession, "localId" | "synced">,
): Promise<number> {
  const db = getLocalDB();
  const id = await db.drylandSessions.add({ ...data, synced: 0 });
  await enqueue("dryland_sessions", "insert", { ...data, localId: String(id) });
  bumpDataRevision();
  return id;
}

export async function getDrylandSessions(userId: string): Promise<LocalDrylandSession[]> {
  const db = getLocalDB();
  return db.drylandSessions.where("userId").equals(userId).reverse().sortBy("date");
}

// ── All sessions (for coach engine) ───────────────────────────────────────

export async function getAllSessionsForUser(userId: string) {
  const [erg, water, team, dryland] = await Promise.all([
    getErgSessions(userId),
    getWaterSessions(userId),
    getTeamSessions(userId),
    getDrylandSessions(userId),
  ]);
  return { erg, water, team, dryland };
}
