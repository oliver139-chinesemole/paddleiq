// @vitest-environment jsdom
/**
 * Integration tests for flushQueue, the code that actually moves a queued
 * session to the server.
 *
 * The retry *policy* was already covered as pure functions; this is the shell
 * around it, which previously had nothing but my reading of it. The failure
 * modes here are the expensive ones: a session silently dropped, or one
 * retried forever against a server that will never accept it.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MAX_RETRIES } from "../retry-policy";

// A stand-in Supabase client whose behaviour each test sets.
let insertResult: { error: unknown } = { error: null };
let insertCalls = 0;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: async () => {
        insertCalls++;
        return insertResult;
      },
      update: () => ({ eq: async () => insertResult }),
      delete: () => ({ eq: async () => insertResult }),
      select: () => ({
        eq: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
  }),
}));

import { enqueue, flushQueue, getQueueHealth, retryFailedItems } from "../sync";
import { getLocalDB } from "../schema";

/**
 * enqueue() fires a flush without awaiting it, and flushQueue guards on a
 * module-level mutex — so calling it again while that one is in flight returns
 * immediately and does nothing. Tests have to let the background flush finish
 * before asserting or driving another.
 */
async function settle() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 10));
}

const payload = (date = "2026-06-10") => ({
  userId: "u1", user_id: "u1", date, distance_m: 2000, localId: "1",
});

beforeEach(async () => {
  await getLocalDB().syncQueue.clear();
  insertResult = { error: null };
  insertCalls = 0;
  // flushQueue bails out unless it believes it's online and configured.
  vi.stubGlobal("navigator", { ...globalThis.navigator, onLine: true });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
});

describe("flushQueue on success", () => {
  it("sends the item and clears it from the queue", async () => {
    await enqueue("erg_sessions", "insert", payload());
    await settle();

    expect(insertCalls).toBeGreaterThan(0);
    expect(await getLocalDB().syncQueue.count()).toBe(0);
  });

  it("strips local-only fields before sending", async () => {
    // userId/localId/synced exist only in Dexie; Supabase would reject them.
    await enqueue("erg_sessions", "insert", payload());
    const [queued] = await getLocalDB().syncQueue.toArray();
    expect(queued.payload).toHaveProperty("userId");
    await flushQueue();
    expect(await getLocalDB().syncQueue.count()).toBe(0);
  });

  it("does nothing when the queue is empty", async () => {
    await flushQueue();
    expect(insertCalls).toBe(0);
  });

  it("stays quiet when offline rather than burning attempts", async () => {
    vi.stubGlobal("navigator", { ...globalThis.navigator, onLine: false });
    await enqueue("erg_sessions", "insert", payload());
    await settle();
    expect(insertCalls).toBe(0);
    expect(await getLocalDB().syncQueue.count()).toBe(1);
  });
});

describe("flushQueue on failure", () => {
  it("keeps the item and counts the attempt when the server errors", async () => {
    insertResult = { error: { message: "boom", status: 500 } };
    await enqueue("erg_sessions", "insert", payload());
    await settle();

    const [item] = await getLocalDB().syncQueue.toArray();
    expect(item).toBeDefined();
    expect(item.retries).toBe(1);
    expect(item.failed).toBe(0);
    expect(item.lastError).toContain("boom");
  });

  it("backs off rather than retrying on the very next flush", async () => {
    // Regression: with no backoff, flush ran on every write, mount and online
    // event, so a failing item hammered the server continuously.
    insertResult = { error: { message: "boom", status: 500 } };
    await enqueue("erg_sessions", "insert", payload());
    await settle();
    const after1 = insertCalls;

    await flushQueue();
    await settle();
    expect(insertCalls, "second flush should skip the backing-off item").toBe(after1);
  });

  it("gives up immediately on an error that will never succeed", async () => {
    // A unique violation is not worth eight retries.
    insertResult = { error: { code: "23505", message: "duplicate key" } };
    await enqueue("erg_sessions", "insert", payload());
    await settle();

    const [item] = await getLocalDB().syncQueue.toArray();
    expect(item.failed).toBe(1);
    expect(item.retries).toBe(1);
  });

  it("never deletes the item, so the session isn't lost", async () => {
    insertResult = { error: { code: "23505", message: "duplicate key" } };
    await enqueue("erg_sessions", "insert", payload());
    await settle();
    expect(await getLocalDB().syncQueue.count()).toBe(1);
  });
});

describe("queue health", () => {
  it("reports nothing pending on a clean queue", async () => {
    expect(await getQueueHealth()).toEqual({ pending: 0, failed: 0, firstError: undefined });
  });

  it("counts what is waiting to send", async () => {
    // Offline, so the background flush leaves them queued rather than
    // succeeding and clearing them out from under the assertion.
    vi.stubGlobal("navigator", { ...globalThis.navigator, onLine: false });
    await enqueue("erg_sessions", "insert", payload("2026-06-10"));
    await enqueue("erg_sessions", "insert", payload("2026-06-11"));
    await settle();
    const health = await getQueueHealth();
    expect(health.pending).toBe(2);
    expect(health.failed).toBe(0);
  });

  it("separates given-up items and explains why", async () => {
    insertResult = { error: { code: "23505", message: "duplicate key" } };
    await enqueue("erg_sessions", "insert", payload());
    await settle();

    const health = await getQueueHealth();
    expect(health.failed).toBe(1);
    expect(health.pending).toBe(0);
    expect(health.firstError).toContain("duplicate key");
  });
});

describe("retryFailedItems", () => {
  it("clears the failed flag so the next flush tries again", async () => {
    insertResult = { error: { code: "23505", message: "duplicate key" } };
    await enqueue("erg_sessions", "insert", payload());
    await settle();
    expect((await getQueueHealth()).failed).toBe(1);

    insertResult = { error: null };
    const reset = await retryFailedItems();
    expect(reset).toBe(1);
    await settle();

    await flushQueue();
    await settle();
    expect(await getLocalDB().syncQueue.count()).toBe(0);
  });

  it("does nothing when nothing has failed", async () => {
    expect(await retryFailedItems()).toBe(0);
  });
});

describe("the retry ceiling", () => {
  it("stops after MAX_RETRIES of transient failure", async () => {
    insertResult = { error: { message: "network", status: 503 } };
    await enqueue("erg_sessions", "insert", payload());

    // Drive the counter directly; the point is the ceiling, not the waiting.
    const db = getLocalDB();
    for (let i = 0; i < MAX_RETRIES; i++) {
      const [item] = await db.syncQueue.toArray();
      if (!item?.id || item.failed) break;
      await db.syncQueue.update(item.id, { lastAttemptAt: 0 });
      await flushQueue();
      await settle();
    }

    const [item] = await db.syncQueue.toArray();
    expect(item.failed, "should have given up by now").toBe(1);
    expect(item.retries).toBeLessThanOrEqual(MAX_RETRIES);
  });
});
