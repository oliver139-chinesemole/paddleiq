"use client";
/**
 * Session write/read helpers.
 * Every write: save to Dexie immediately (optimistic), then enqueue a Supabase sync.
 * Every read: read from Dexie (fast, offline-safe), merged with server rows on reconnect.
 */
import { getLocalDB, type LocalErgSession, type LocalWaterSession, type LocalTeamSession, type LocalDrylandSession } from "./schema";
import { enqueue } from "./sync";

// ── ErgSessions ────────────────────────────────────────────────────────────

export async function saveErgSession(
  data: Omit<LocalErgSession, "localId" | "synced">,
): Promise<number> {
  const db = getLocalDB();
  const id = await db.ergSessions.add({ ...data, synced: 0 });
  await enqueue("erg_sessions", "insert", { ...data, localId: String(id) });
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
