import { describe, it, expect, vi } from "vitest";
import {
  bumpDataRevision,
  subscribeDataRevision,
  getDataRevision,
  getDataRevisionServerSnapshot,
} from "../revision";

describe("the data revision store", () => {
  it("moves forward on every write", () => {
    const before = getDataRevision();
    bumpDataRevision();
    expect(getDataRevision()).toBeGreaterThan(before);
  });

  it("tells subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDataRevision(listener);
    bumpDataRevision();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops telling them once unsubscribed", () => {
    // A listener kept after unmount would set state on a dead component.
    const listener = vi.fn();
    subscribeDataRevision(listener)();
    bumpDataRevision();
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports several readers at once", () => {
    // The nav, the dashboard and a page can all be watching.
    const a = vi.fn();
    const b = vi.fn();
    const ua = subscribeDataRevision(a);
    const ub = subscribeDataRevision(b);
    bumpDataRevision();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    ua(); ub();
  });

  it("returns a stable value between writes", () => {
    // useSyncExternalStore re-renders forever if the snapshot keeps changing.
    bumpDataRevision();
    expect(getDataRevision()).toBe(getDataRevision());
  });

  it("gives the server a fixed snapshot", () => {
    // The server has no local writes; a moving value here would mean the
    // markup React sends never matches what it hydrates.
    expect(getDataRevisionServerSnapshot()).toBe(0);
  });
});
