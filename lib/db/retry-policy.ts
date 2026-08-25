// Retry policy for the offline sync queue.
//
// Pure so it can be tested without IndexedDB or a Supabase client — the queue
// itself is the hardest thing in the app to exercise directly, which is why it
// went untested and why the policy lived only in a comment.
//
// The previous behaviour: `retries` was incremented on every failure and never
// read by anything. There was no cap and no backoff despite a comment claiming
// otherwise, so an item that could never succeed — a constraint violation, a
// row whose parent was deleted — was retried on every flush forever. Flush runs
// on every local write, every mount and every `online` event.

/** Give up after this many consecutive failures and mark the item for review. */
export const MAX_RETRIES = 8;

/** First retry waits this long; each subsequent one doubles. */
export const BASE_BACKOFF_MS = 5_000;

/** Ceiling on the wait, so a long outage doesn't push retries days out. */
export const MAX_BACKOFF_MS = 60 * 60 * 1000;

/**
 * Queue length past which we warn. Deliberately not enforced by dropping items:
 * a full queue means unsynced sessions the athlete has logged, and silently
 * discarding their training data is far worse than an oversized queue.
 */
export const QUEUE_WARN_SIZE = 500;

export type FailureKind = "permanent" | "transient";

/** The subset of a queue item this policy needs. */
export interface RetryableItem {
  retries?: number;
  lastAttemptAt?: number;
  failed?: 0 | 1;
}

/**
 * How long to wait before the nth retry. `retries` is the number of failures
 * so far, so 0 means "never tried" and the item is due immediately.
 */
export function backoffMs(retries: number): number {
  if (!Number.isFinite(retries) || retries <= 0) return 0;
  const exp = BASE_BACKOFF_MS * 2 ** (retries - 1);
  return Math.min(exp, MAX_BACKOFF_MS);
}

/** True when an item should be attempted now. */
export function isDue(item: RetryableItem, now: number): boolean {
  if (item.failed) return false;
  const retries = item.retries ?? 0;
  if (retries === 0) return true;
  const last = item.lastAttemptAt ?? 0;
  return now - last >= backoffMs(retries);
}

/** True once an item has burned through its retries. */
export function isExhausted(item: RetryableItem): boolean {
  return (item.retries ?? 0) >= MAX_RETRIES;
}

/**
 * Whether an error is worth retrying.
 *
 * Postgres SQLSTATE classes 22 (data exception), 23 (integrity violation) and
 * 42 (syntax or access rule) describe requests that will fail identically no
 * matter how often they're repeated. Everything else — network drops, 5xx,
 * rate limits — is worth another attempt.
 *
 * Defaults to transient on anything unrecognised: retrying a few extra times
 * costs a little traffic, whereas wrongly calling something permanent strands
 * an athlete's session forever.
 */
export function classifyFailure(error: unknown): FailureKind {
  if (!error || typeof error !== "object") return "transient";
  const e = error as { code?: unknown; status?: unknown };

  if (typeof e.code === "string" && /^(22|23|42)/.test(e.code)) return "permanent";

  if (typeof e.status === "number") {
    // 408 Request Timeout and 429 Too Many Requests are explicitly retryable.
    if (e.status === 408 || e.status === 429) return "transient";
    if (e.status >= 400 && e.status < 500) return "permanent";
  }

  return "transient";
}

export interface QueueUpdate {
  retries: number;
  lastAttemptAt: number;
  failed: 0 | 1;
  lastError: string;
}

/** Short, storable description of a failure, for diagnosing a stuck queue. */
export function describeError(error: unknown): string {
  if (!error) return "unknown error";
  if (typeof error === "string") return error.slice(0, 300);
  const e = error as { message?: unknown; code?: unknown; status?: unknown };
  const parts = [
    typeof e.code === "string" ? `[${e.code}]` : "",
    typeof e.status === "number" ? `(${e.status})` : "",
    typeof e.message === "string" ? e.message : "",
  ].filter(Boolean);
  return (parts.join(" ") || String(error)).slice(0, 300);
}

/**
 * The queue-item fields to write after a failed attempt.
 *
 * A permanent failure stops immediately rather than burning eight pointless
 * retries; a transient one backs off and gives up once exhausted. Either way
 * the item is marked rather than deleted, so the local row survives and the
 * count can be surfaced instead of the data quietly disappearing.
 */
export function onFailure(item: RetryableItem, error: unknown, now: number): QueueUpdate {
  const retries = (item.retries ?? 0) + 1;
  const kind = classifyFailure(error);
  const exhausted = retries >= MAX_RETRIES;
  return {
    retries,
    lastAttemptAt: now,
    failed: kind === "permanent" || exhausted ? 1 : 0,
    lastError: describeError(error),
  };
}

/** Milliseconds until the soonest retry, or null if nothing is waiting. */
export function nextDueIn(items: RetryableItem[], now: number): number | null {
  const waits = items
    .filter((i) => !i.failed)
    .map((i) => Math.max(0, backoffMs(i.retries ?? 0) - (now - (i.lastAttemptAt ?? 0))));
  return waits.length ? Math.min(...waits) : null;
}
