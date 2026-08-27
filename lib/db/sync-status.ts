/**
 * Turning queue health into something an athlete can act on.
 *
 * getQueueHealth() and retryFailedItems() were written to "let the app surface
 * a stuck queue rather than leaving the athlete to notice their sessions never
 * appear on another device" — and then nothing ever called them. An athlete
 * whose sessions had stopped reaching the server had no way to find out.
 *
 * The distinction that matters is between a queue that is waiting and a queue
 * that has given up. They look identical in a raw count and mean completely
 * different things: one needs patience, the other needs a person. And when
 * Supabase isn't configured there's a third case, which is neither — nothing
 * is wrong, there is simply nowhere to sync to, and calling that an error
 * would train people to ignore a warning that is sometimes real.
 */

export type SyncTone = "ok" | "waiting" | "local-only" | "problem";

export interface SyncStatus {
  tone: SyncTone;
  title: string;
  detail: string;
  /** Whether to offer a retry button. */
  canRetry: boolean;
}

export interface SyncStatusInput {
  pending: number;
  failed: number;
  firstError?: string;
  /** Whether Supabase is configured at all. */
  configured: boolean;
  online: boolean;
}

const sessions = (n: number) => `${n} ${n === 1 ? "session" : "sessions"}`;

export function describeSyncStatus(input: SyncStatusInput): SyncStatus {
  const { pending, failed, firstError, configured, online } = input;

  // Without an account there is nothing to sync to, so a queue length here
  // says nothing about health. Stating the actual situation is more useful
  // than either a green tick or a warning.
  if (!configured) {
    return {
      tone: "local-only",
      title: "Saved on this device",
      detail:
        "Your sessions are stored in this browser. They aren't backed up to an account, so clearing site data or switching device loses them — export a copy if that matters.",
      canRetry: false,
    };
  }

  // Given-up items come first: they're the only state that needs a decision.
  if (failed > 0) {
    return {
      tone: "problem",
      title: `${sessions(failed)} couldn't be saved`,
      detail: firstError
        ? `The server rejected them: ${firstError}. They're still on this device, so nothing is lost.`
        : "They're still on this device, so nothing is lost.",
      canRetry: true,
    };
  }

  if (pending > 0 && !online) {
    return {
      tone: "waiting",
      title: `${sessions(pending)} waiting for a connection`,
      detail: "They'll be sent automatically once you're back online.",
      canRetry: false,
    };
  }

  if (pending > 0) {
    return {
      tone: "waiting",
      title: `${sessions(pending)} syncing`,
      detail: "They're on this device already and will reach your account shortly.",
      canRetry: false,
    };
  }

  return {
    tone: "ok",
    title: "Everything is backed up",
    detail: "Every session you've logged has reached your account.",
    canRetry: false,
  };
}
