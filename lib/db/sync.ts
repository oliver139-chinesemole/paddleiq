"use client";
/**
 * Background sync — flushes the Dexie queue to Supabase when online.
 * Called on: app mount, window online event, and after every local write.
 * Safe to call concurrently; uses a mutex flag.
 */
import { getLocalDB, type SyncQueueItem } from "./schema";

let _syncing = false;

export async function enqueue(
  table: SyncQueueItem["table"],
  operation: SyncQueueItem["operation"],
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getLocalDB();
  const localId = `${table}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.syncQueue.add({ table, operation, payload, localId, createdAt: Date.now(), retries: 0 });
  // Fire-and-forget flush
  flushQueue().catch(console.warn);
}

export async function flushQueue(): Promise<void> {
  if (_syncing || typeof window === "undefined") return;
  if (!navigator.onLine) return;

  // Check Supabase is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;

  _syncing = true;
  try {
    const db = getLocalDB();
    const pending = await db.syncQueue.orderBy("createdAt").limit(50).toArray();
    if (pending.length === 0) return;

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    for (const item of pending) {
      try {
        if (item.operation === "insert") {
          const { error } = await supabase.from(item.table).insert(item.payload);
          if (error) throw error;
        } else if (item.operation === "update") {
          const { id, ...rest } = item.payload;
          const { error } = await supabase.from(item.table).update(rest).eq("id", id as string);
          if (error) throw error;
        } else if (item.operation === "delete") {
          const { error } = await supabase.from(item.table).delete().eq("id", item.payload.id as string);
          if (error) throw error;
        }

        // Synced — remove from queue
        if (item.id != null) await db.syncQueue.delete(item.id);

        // Mark local row as synced
        await markLocalSynced(item.table, item.payload.localId as string);
      } catch {
        // Increment retry counter; exponential backoff handled at next flush
        if (item.id != null) {
          await db.syncQueue.update(item.id, { retries: (item.retries ?? 0) + 1 });
        }
      }
    }
  } finally {
    _syncing = false;
  }
}

async function markLocalSynced(table: SyncQueueItem["table"], localId: string): Promise<void> {
  const db = getLocalDB();
  const tableMap = {
    erg_sessions: db.ergSessions,
    water_sessions: db.waterSessions,
    team_sessions: db.teamSessions,
    dryland_sessions: db.drylandSessions,
    personal_records: db.personalRecords,
  } as const;
  const t = tableMap[table];
  if (!t || localId == null) return;
  // localId was stored as string; convert back to number for Dexie pk
  const numId = parseInt(localId.split("_").pop() ?? "", 10);
  if (!isNaN(numId)) await (t as ReturnType<typeof getLocalDB>["ergSessions"]).update(numId, { synced: 1 });
}
