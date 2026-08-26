"use client";

/**
 * A counter that changes whenever the athlete's local training data changes.
 *
 * Components that read Dexie do it inside an effect keyed on something stable
 * like the user id, which means they read once and never again. That's fine
 * for a page that unmounts between visits, and wrong for anything living in
 * the layout: the top navigation stays mounted across every client-side
 * navigation, so its notification feed was computed once per hard page load.
 * An athlete could set a personal best, get redirected to the dashboard, and
 * the bell would know nothing about it until they next reloaded the app.
 *
 * Subscribing to this gives those readers a dependency that actually moves.
 * It's the same shape as the preferences and active-plan stores, so it reads
 * the same way through useSyncExternalStore.
 *
 * Deliberately in-memory and per-tab. It answers "did this tab just write
 * something", which is exactly the staleness that was visible; cross-tab
 * changes are a different problem and would need the storage event.
 */

let revision = 0;
const listeners = new Set<() => void>();

/** Call after any write that a mounted view might be showing. */
export function bumpDataRevision(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

export function subscribeDataRevision(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDataRevision(): number {
  return revision;
}

/** The server never has local writes, so its snapshot is always the initial one. */
export function getDataRevisionServerSnapshot(): number {
  return 0;
}
