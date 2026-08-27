"use client";

/**
 * Watches the sync queue so the app can tell an athlete when their sessions
 * have stopped reaching the server.
 *
 * Re-reads on three signals, because the queue changes for three reasons: a
 * write (the data revision), coming back online, and a flush finishing. The
 * last one has no event of its own, so there's a slow poll — a stuck queue is
 * not urgent, but it shouldn't need a page reload to notice either.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getQueueHealth, retryFailedItems, flushQueue, type QueueHealth } from "@/lib/db/sync";
import {
  subscribeDataRevision,
  getDataRevision,
  getDataRevisionServerSnapshot,
} from "@/lib/db/revision";

const EMPTY: QueueHealth = { pending: 0, failed: 0 };
const POLL_MS = 30_000;

export function useQueueHealth() {
  const [health, setHealth] = useState<QueueHealth>(EMPTY);
  const [online, setOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const revision = useSyncExternalStore(
    subscribeDataRevision,
    getDataRevision,
    getDataRevisionServerSnapshot,
  );

  useEffect(() => {
    let cancelled = false;

    async function read() {
      try {
        const next = await getQueueHealth();
        if (!cancelled) setHealth(next);
      } catch {
        // Never worth breaking the page for.
        if (!cancelled) setHealth(EMPTY);
      }
    }

    function syncOnline() {
      if (!cancelled) setOnline(navigator.onLine);
    }

    syncOnline();
    read();

    const timer = setInterval(read, POLL_MS);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("online", read);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("online", read);
    };
  }, [revision]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await retryFailedItems();
      await flushQueue();
      setHealth(await getQueueHealth());
    } catch {
      // The status will still show the problem; nothing more to say here.
    } finally {
      setRetrying(false);
    }
  }, []);

  return { health, online, retry, retrying };
}
