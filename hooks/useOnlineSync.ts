"use client";
/**
 * useOnlineSync — listens for the browser coming back online and flushes
 * the Dexie sync queue to Supabase.
 */
import { useEffect } from "react";

export function useOnlineSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function flush() {
      // Lazy import so this never runs on the server
      const { flushQueue } = await import("@/lib/db/sync");
      flushQueue().catch(console.warn);
    }

    window.addEventListener("online", flush);
    // Also flush on mount in case we're already online
    flush();

    return () => window.removeEventListener("online", flush);
  }, []);
}
