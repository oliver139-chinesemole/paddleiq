import { describe, it, expect } from "vitest";
import { describeSyncStatus, type SyncStatusInput } from "../sync-status";

const base: SyncStatusInput = { pending: 0, failed: 0, configured: true, online: true };

describe("describeSyncStatus", () => {
  it("confirms everything is backed up when the queue is clear", () => {
    const s = describeSyncStatus(base);
    expect(s.tone).toBe("ok");
    expect(s.canRetry).toBe(false);
  });

  it("treats a queue with no account as a statement of fact, not a fault", () => {
    // Without Supabase there is nowhere to sync to, so a queue length says
    // nothing about health. Calling it an error trains people to ignore the
    // warning for the times it's real.
    const s = describeSyncStatus({ ...base, configured: false, pending: 42 });
    expect(s.tone).toBe("local-only");
    expect(s.canRetry).toBe(false);
    expect(s.title).not.toMatch(/error|fail|problem/i);
    // It should still say what the risk actually is.
    expect(s.detail).toMatch(/aren't backed up|export/i);
  });

  it("says so plainly when items have been given up on", () => {
    const s = describeSyncStatus({ ...base, failed: 2, firstError: "duplicate key" });
    expect(s.tone).toBe("problem");
    expect(s.title).toContain("2 sessions");
    expect(s.detail).toContain("duplicate key");
    expect(s.canRetry).toBe(true);
  });

  it("reassures that a failure hasn't lost the session", () => {
    // The whole point of never deleting a failed queue item.
    const s = describeSyncStatus({ ...base, failed: 1 });
    expect(s.detail).toMatch(/still on this device|nothing is lost/i);
  });

  it("prioritises failures over items merely waiting", () => {
    // A person needs to see the one that needs a decision.
    const s = describeSyncStatus({ ...base, pending: 9, failed: 1 });
    expect(s.tone).toBe("problem");
  });

  it("distinguishes waiting offline from waiting online", () => {
    const offline = describeSyncStatus({ ...base, pending: 3, online: false });
    expect(offline.tone).toBe("waiting");
    expect(offline.detail).toMatch(/back online/i);

    const online = describeSyncStatus({ ...base, pending: 3 });
    expect(online.tone).toBe("waiting");
    expect(online.detail).not.toMatch(/back online/i);
  });

  it("never offers a retry for something retrying on its own", () => {
    expect(describeSyncStatus({ ...base, pending: 5 }).canRetry).toBe(false);
    expect(describeSyncStatus({ ...base, pending: 5, online: false }).canRetry).toBe(false);
  });

  it("counts one session in the singular", () => {
    expect(describeSyncStatus({ ...base, failed: 1 }).title).toContain("1 session ");
    expect(describeSyncStatus({ ...base, pending: 1 }).title).toContain("1 session");
    expect(describeSyncStatus({ ...base, pending: 2 }).title).toContain("2 sessions");
  });

  it("copes with a failure that carries no error text", () => {
    const s = describeSyncStatus({ ...base, failed: 1, firstError: undefined });
    expect(s.detail).not.toMatch(/undefined/);
    expect(s.canRetry).toBe(true);
  });
});
