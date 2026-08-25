// Local history of form checks, so a paddler can see whether their numbers are
// moving. Mirrors lib/video/db.ts: IndexedDB, on-device only, no upload.
//
// Only the derived metrics are stored, never the footage. A clip is large and
// personal; the handful of numbers we extract from it is neither.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StrokeMetrics } from "./analyze";
import type { PaddleSide } from "./landmarks";

export type FormCheckSource = "camera" | "file" | "clip";

export interface FormCheckResult {
  id?: number;
  date: string;
  createdAt: number;
  source: FormCheckSource;
  side: PaddleSide;
  metrics: StrokeMetrics;
  score: number;
  /** Set when the check came from a clip in the video library. */
  clipId?: number;
  label?: string;
}

interface FormCheckDB extends DBSchema {
  checks: {
    key: number;
    value: FormCheckResult;
    indexes: { "by-date": number };
  };
}

let _db: IDBPDatabase<FormCheckDB> | null = null;

async function getDB() {
  if (!_db) {
    _db = await openDB<FormCheckDB>("paddleiq-formcheck", 1, {
      upgrade(db) {
        const store = db.createObjectStore("checks", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-date", "createdAt");
      },
    });
  }
  return _db;
}

export async function saveFormCheck(r: Omit<FormCheckResult, "id">): Promise<number> {
  return (await getDB()).add("checks", r as FormCheckResult);
}

/** Newest first. */
export async function getFormChecks(): Promise<FormCheckResult[]> {
  const all = await (await getDB()).getAllFromIndex("checks", "by-date");
  return all.reverse();
}

export async function deleteFormCheck(id: number): Promise<void> {
  return (await getDB()).delete("checks", id);
}

/**
 * The most recent check before `createdAt`, used to show deltas.
 * Only compares like with like — a different paddling side is a different
 * movement, so trending across sides would be misleading.
 */
export async function previousCheck(
  createdAt: number,
  side: PaddleSide
): Promise<FormCheckResult | null> {
  const all = await getFormChecks();
  return all.find((c) => c.createdAt < createdAt && c.side === side) ?? null;
}
