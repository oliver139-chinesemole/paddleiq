import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const VIDEO_CATEGORIES = [
  "Catch",
  "Exit",
  "Rotation",
  "Reach",
  "Timing",
  "Race Start",
  "Erg Stroke",
  "Team Sync",
  "Full Stroke",
  "Other",
] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export interface VideoClip {
  id?: number;
  label: string;
  category: VideoCategory;
  notes: string;
  date: string;
  durationSec: number;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

interface VideoDB extends DBSchema {
  clips: {
    key: number;
    value: VideoClip;
    indexes: { "by-date": number };
  };
}

let _db: IDBPDatabase<VideoDB> | null = null;

async function getDB() {
  if (!_db) {
    _db = await openDB<VideoDB>("paddleiq-video", 1, {
      upgrade(db) {
        const store = db.createObjectStore("clips", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-date", "createdAt");
      },
    });
  }
  return _db;
}

export async function saveVideoClip(clip: Omit<VideoClip, "id">): Promise<number> {
  return (await getDB()).add("clips", clip as VideoClip);
}

export async function getAllVideoClips(): Promise<VideoClip[]> {
  const all = await (await getDB()).getAllFromIndex("clips", "by-date");
  return all.reverse();
}

export async function getVideoClip(id: number): Promise<VideoClip | undefined> {
  return (await getDB()).get("clips", id);
}

export async function deleteVideoClip(id: number): Promise<void> {
  return (await getDB()).delete("clips", id);
}
