import Dexie, { type Table } from "dexie";
import type { ErgSession, WaterSession, TeamSession, DrylandSession, PersonalRecord } from "@/lib/types";

// ──────────────────────────────────────────────────────────────────────────
// Pending sync queue — any write that hasn't been flushed to Supabase yet
// ──────────────────────────────────────────────────────────────────────────
export interface SyncQueueItem {
  id?: number;
  table: "erg_sessions" | "water_sessions" | "team_sessions" | "dryland_sessions" | "personal_records";
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  localId: string;            // client-generated id for dedup
  createdAt: number;
  retries: number;
  /** When the last attempt was made, for backoff. Absent until first failure. */
  lastAttemptAt?: number;
  /** 1 once we've stopped retrying. Indexed, so 0/1 rather than a boolean. */
  failed?: 0 | 1;
  /** Why it stopped, so a stuck queue can be diagnosed. */
  lastError?: string;
}

// Local row shape: same as Supabase types but with a local numeric id
export interface LocalErgSession extends Omit<ErgSession, "id"> {
  localId?: number;
  serverId?: string;          // Supabase UUID — null until synced
  userId: string;
  synced: 0 | 1;
}

export interface LocalWaterSession extends Omit<WaterSession, "id"> {
  localId?: number;
  serverId?: string;
  userId: string;
  synced: 0 | 1;
}

export interface LocalTeamSession extends Omit<TeamSession, "id"> {
  localId?: number;
  serverId?: string;
  userId: string;
  synced: 0 | 1;
}

export interface LocalDrylandSession extends Omit<DrylandSession, "id"> {
  localId?: number;
  serverId?: string;
  userId: string;
  synced: 0 | 1;
}

export interface LocalPR extends Omit<PersonalRecord, "id"> {
  localId?: number;
  serverId?: string;
  userId: string;
  synced: 0 | 1;
}

// ──────────────────────────────────────────────────────────────────────────
// Dexie database definition
// ──────────────────────────────────────────────────────────────────────────
export class PaddleIQDatabase extends Dexie {
  ergSessions!: Table<LocalErgSession, number>;
  waterSessions!: Table<LocalWaterSession, number>;
  teamSessions!: Table<LocalTeamSession, number>;
  drylandSessions!: Table<LocalDrylandSession, number>;
  personalRecords!: Table<LocalPR, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("paddleiq");
    this.version(1).stores({
      ergSessions:     "++localId, userId, date, synced",
      waterSessions:   "++localId, userId, date, synced",
      teamSessions:    "++localId, userId, date, synced",
      drylandSessions: "++localId, userId, date, synced",
      personalRecords: "++localId, userId, category, distance_m, synced",
      syncQueue:       "++id, table, localId, createdAt",
    });
    // No version bump for lastAttemptAt / failed / lastError: IndexedDB object
    // stores don't enforce a schema, and nothing queries those fields by index
    // — the queue is small enough to filter in JS. Declaring an index we never
    // read would mean an upgrade path to maintain for no benefit, and rows
    // written before the fields existed simply read as undefined.
  }
}

// Singleton — one DB per browser context
let _db: PaddleIQDatabase | null = null;

export function getLocalDB(): PaddleIQDatabase {
  if (typeof window === "undefined") throw new Error("Dexie only runs in the browser");
  if (!_db) _db = new PaddleIQDatabase();
  return _db;
}
