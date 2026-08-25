"use client";

// Loads the notification feed and tracks what the athlete has already seen.
//
// Read state is a single "last opened" timestamp in localStorage rather than a
// per-item read flag: notifications are derived from other records, so there's
// nowhere to write a flag back to, and one marker is all the bell needs.

import { useCallback, useEffect, useState } from "react";
import {
  deriveNotifications, unreadCount, latestAt,
  type AppNotification, type NotificationSources,
} from "@/lib/notifications/derive";

const SEEN_KEY = "paddleiq:notifications:lastSeenAt";

function readLastSeen(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function writeLastSeen(at: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_KEY, String(at));
}

export function useNotifications(isDemoMode: boolean, userId?: string) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  // Read lazily rather than in an effect, which would set state synchronously
  // and cascade a re-render. Safe for hydration because `items` is empty on the
  // first pass, so the unread count is zero on server and client alike.
  const [lastSeenAt, setLastSeenAt] = useState(readLastSeen);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let sources: NotificationSources = {};

        if (isDemoMode) {
          const { mockPRs } = await import("@/lib/data/seed");
          sources = {
            prs: mockPRs,
            announcements: [
              {
                id: "demo-ann-1",
                content: "Practice this Saturday at 7am — all paddlers required. Bring race gear.",
                author_name: "Coach Sarah",
                created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
              },
            ],
            assignments: [
              {
                id: "demo-assign-1",
                title: "4 × 500m erg intervals",
                created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
                target_date: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
              },
            ],
            events: [
              {
                id: "demo-event-1",
                title: "Saturday water session",
                event_type: "practice",
                starts_at: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
              },
            ],
          };
        } else if (userId) {
          const { createClient } = await import("@/lib/supabase/client");
          const sb = createClient();
          const [prRes, assignRes, feedRes, eventRes] = await Promise.all([
            sb.from("personal_records")
              .select("id, category, distance_m, time_sec, date, improvement_sec")
              .eq("user_id", userId).order("date", { ascending: false }).limit(10),
            sb.from("workout_assignments")
              .select("id, title, workout_type, target_date, completed, created_at")
              .eq("assigned_to", userId).order("created_at", { ascending: false }).limit(10),
            sb.from("team_feed")
              .select("id, content, created_at")
              .order("created_at", { ascending: false }).limit(10),
            sb.from("team_events")
              .select("id, title, event_type, starts_at")
              .order("starts_at", { ascending: true }).limit(10),
          ]);

          sources = {
            prs: (prRes.data ?? []) as NotificationSources["prs"],
            assignments: (assignRes.data ?? []) as NotificationSources["assignments"],
            announcements: (feedRes.data ?? []) as NotificationSources["announcements"],
            events: (eventRes.data ?? []) as NotificationSources["events"],
          };
        }

        if (!cancelled) setItems(deriveNotifications(sources));
      } catch {
        // A notification feed is never worth breaking the page over.
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isDemoMode, userId]);

  const markSeen = useCallback(() => {
    // Just "now": unreadCount ignores anything still in the future, so there's
    // no need to reach past it to cover upcoming events.
    const at = Date.now();
    writeLastSeen(at);
    setLastSeenAt(at);
  }, []);

  return {
    items,
    loading,
    unread: unreadCount(items, lastSeenAt),
    markSeen,
  };
}
