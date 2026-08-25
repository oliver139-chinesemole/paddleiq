// Notifications, derived rather than stored.
//
// There is no notifications table, and adding one would mean a writer on every
// path that can produce an event plus a backfill for everything already logged.
// Everything worth telling an athlete about is already recorded somewhere —
// a PR row, an assigned workout, a team announcement, an upcoming event — so
// this reads those and shapes them into a feed.
//
// Deriving also means it works offline and in demo mode, and can't drift out of
// sync with the underlying records.
//
// Pure functions only.

import { toLocalDateStr, daysBefore, parseLocalDate } from "@/lib/utils";

export type NotificationKind = "pr" | "assignment" | "announcement" | "event";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Epoch millis, used for ordering and unread comparison. */
  at: number;
  /** Where tapping it should go. */
  href: string;
}

// ─── source shapes ───────────────────────────────────────────────────────────
// Deliberately minimal so callers can pass rows from Supabase, IndexedDB or
// seed data without adapting them.

export interface PRSource {
  id?: string;
  category: string;
  distance_m: number;
  time_sec: number;
  date: string;
  improvement_sec?: number | null;
}

export interface AssignmentSource {
  id?: string;
  title: string;
  workout_type?: string | null;
  target_date?: string | null;
  completed?: boolean | null;
  created_at?: string | null;
}

export interface AnnouncementSource {
  id?: string;
  content: string;
  author_name?: string | null;
  created_at: string;
}

export interface EventSource {
  id?: string;
  title: string;
  event_type?: string | null;
  starts_at: string;
}

export interface NotificationSources {
  prs?: PRSource[];
  assignments?: AssignmentSource[];
  announcements?: AnnouncementSource[];
  events?: EventSource[];
}

/** How far back a record can be and still be worth surfacing. */
const LOOKBACK_DAYS = 14;
/** How far ahead an event is announced. */
const EVENT_HORIZON_DAYS = 7;
/** Cap so the sheet stays readable. */
export const MAX_NOTIFICATIONS = 20;

function distLabel(m: number): string {
  return m >= 1000 ? `${m / 1000}k` : `${m}m`;
}

function timeLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

/** Epoch millis for a stored date or timestamp, read in local time. */
function atOf(value: string): number {
  return parseLocalDate(value).getTime();
}

/**
 * Builds the notification feed, newest first.
 *
 * `now` is injectable so this is testable and so the caller's idea of today
 * governs — the same thing that made every other date bug in this codebase
 * invisible until it shipped.
 */
export function deriveNotifications(
  sources: NotificationSources,
  now = new Date(),
): AppNotification[] {
  const out: AppNotification[] = [];
  const floor = atOf(toLocalDateStr(daysBefore(now, LOOKBACK_DAYS)));
  const horizon = atOf(toLocalDateStr(daysBefore(now, -EVENT_HORIZON_DAYS)));
  const nowMs = now.getTime();

  for (const [i, pr] of (sources.prs ?? []).entries()) {
    const at = atOf(pr.date);
    if (at < floor || at > nowMs) continue;
    const gain = pr.improvement_sec;
    out.push({
      id: pr.id ?? `pr-${i}`,
      kind: "pr",
      title: `New ${distLabel(pr.distance_m)} ${pr.category} PR`,
      body: gain
        ? `${timeLabel(pr.time_sec)} — ${gain.toFixed(1)}s faster than your previous best.`
        : `${timeLabel(pr.time_sec)}. Nicely done.`,
      at,
      href: "/records",
    });
  }

  for (const [i, a] of (sources.assignments ?? []).entries()) {
    if (a.completed) continue;
    // Prefer when it was set; fall back to when it's due.
    const stamp = a.created_at ?? a.target_date;
    if (!stamp) continue;
    const at = atOf(stamp);
    if (at < floor) continue;
    out.push({
      id: a.id ?? `assign-${i}`,
      kind: "assignment",
      title: "Workout assigned",
      body: a.target_date
        ? `${a.title} — due ${new Date(atOf(a.target_date)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
        : a.title,
      at,
      href: "/train",
    });
  }

  for (const [i, a] of (sources.announcements ?? []).entries()) {
    const at = atOf(a.created_at);
    if (at < floor || at > nowMs) continue;
    out.push({
      id: a.id ?? `ann-${i}`,
      kind: "announcement",
      title: a.author_name ? `${a.author_name} posted` : "Team announcement",
      body: a.content.length > 140 ? `${a.content.slice(0, 137)}…` : a.content,
      at,
      href: "/team",
    });
  }

  for (const [i, e] of (sources.events ?? []).entries()) {
    const at = atOf(e.starts_at);
    // Only what's still ahead, and only within the horizon.
    if (at < nowMs || at > horizon) continue;
    out.push({
      id: e.id ?? `event-${i}`,
      kind: "event",
      title: e.event_type === "race" ? "Race coming up" : "Upcoming session",
      body: `${e.title} — ${new Date(at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}.`,
      at,
      href: "/team",
    });
  }

  return out.sort((a, b) => b.at - a.at).slice(0, MAX_NOTIFICATIONS);
}

/** Newest timestamp in a feed, or 0 when empty. */
export function latestAt(items: AppNotification[]): number {
  return items.reduce((max, n) => Math.max(max, n.at), 0);
}

/**
 * Count of items that have happened since the athlete last opened the sheet.
 *
 * Bounded by `now` as well as by `lastSeenAt`, because an upcoming event is
 * timestamped with when it *starts*, not when it was announced — without the
 * upper bound a session three days out would read as unread every time the
 * page loaded, and the dot would never clear.
 *
 * The bell previously showed a hardcoded dot, so it claimed a notification
 * whether or not one existed and never cleared at all.
 */
export function unreadCount(
  items: AppNotification[],
  lastSeenAt: number,
  now = Date.now(),
): number {
  return items.filter((n) => n.at > lastSeenAt && n.at <= now).length;
}
