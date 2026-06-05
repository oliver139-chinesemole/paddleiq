"use client";
/**
 * Background sync — flushes the Dexie queue to Supabase when online.
 * Called on: app mount, window online event, and after every local write.
 * Safe to call concurrently; uses a mutex flag.
 */
import { getLocalDB, type SyncQueueItem } from "./schema";
import { formatTime } from "@/lib/utils";

// Fields that exist only in the local Dexie row and must not reach Supabase
const LOCAL_ONLY = new Set(["localId", "userId", "serverId", "synced"]);

function toRemotePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([k]) => !LOCAL_ONLY.has(k)));
}

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
        const remote = toRemotePayload(item.payload);
        if (item.operation === "insert") {
          const { error } = await supabase.from(item.table).insert(remote);
          if (error) throw error;
        } else if (item.operation === "update") {
          const { id, ...rest } = remote;
          const { error } = await supabase.from(item.table).update(rest).eq("id", id as string);
          if (error) throw error;
        } else if (item.operation === "delete") {
          const { error } = await supabase.from(item.table).delete().eq("id", remote.id as string);
          if (error) throw error;
        }

        // Synced — remove from queue
        if (item.id != null) await db.syncQueue.delete(item.id);

        // Mark local row as synced
        await markLocalSynced(item.table, item.payload.localId as string);

        // After erg/water insert: check if a PR was set by the DB trigger → post to team feed
        if (item.operation === "insert" && (item.table === "erg_sessions" || item.table === "water_sessions")) {
          await maybePostPRToFeed(supabase, item.table, remote).catch(() => { /* non-fatal */ });
        }
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

async function maybePostPRToFeed(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/client").createClient>>,
  table: "erg_sessions" | "water_sessions",
  remote: Record<string, unknown>,
): Promise<void> {
  const user_id  = remote.user_id  as string;
  const distance = remote.distance_m as number;
  if (!user_id || !distance) return;

  const category = table === "erg_sessions" ? "erg" : "water";

  // Query PR — the Supabase trigger already ran synchronously
  const { data: pr } = await supabase
    .from("personal_records")
    .select("time_sec, previous_time_sec, improvement_sec")
    .eq("user_id", user_id)
    .eq("category", category)
    .eq("distance_m", distance)
    .maybeSingle();

  if (!pr) return;
  const isNewPR = pr.improvement_sec > 0 || pr.previous_time_sec == null;
  if (!isNewPR) return;

  // Get user profile + team_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, team_id")
    .eq("id", user_id)
    .maybeSingle();

  if (!profile?.team_id) return;

  const distLabel = distance >= 1000 ? `${distance / 1000}k` : `${distance}m`;
  const typeLabel = category === "erg" ? "erg" : "water";
  const timeLabel = formatTime(pr.time_sec);
  const delta     = pr.improvement_sec > 0 ? ` (−${pr.improvement_sec}s)` : " (first time!)";
  const content   = `${profile.full_name} set a new ${typeLabel} ${distLabel} PR: ${timeLabel}${delta} 🏆`;

  await supabase.from("team_feed").insert({
    team_id:   profile.team_id,
    author_id: user_id,
    post_type: "pr",
    content,
    metadata: { category, distance_m: distance, time_sec: pr.time_sec },
  });
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
  const numId = parseInt(localId, 10);
  if (!isNaN(numId)) await (t as ReturnType<typeof getLocalDB>["ergSessions"]).update(numId, { synced: 1 });
}
