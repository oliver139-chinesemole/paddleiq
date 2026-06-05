"use client";
/**
 * useWakeLock — keeps the screen on during an active recording/session.
 * Silently no-ops on browsers that don't support the Wake Lock API.
 */
import { useRef, useCallback } from "react";

export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    if (lockRef.current) return; // already held
    try {
      if ("wakeLock" in navigator) {
        lockRef.current = await (navigator as Navigator & { wakeLock: { request(type: string): Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        lockRef.current.addEventListener("release", () => { lockRef.current = null; });
      }
    } catch {
      // Silently ignore — device may have denied or not support it
    }
  }, []);

  const release = useCallback(async () => {
    try {
      await lockRef.current?.release();
    } finally {
      lockRef.current = null;
    }
  }, []);

  return { acquire, release };
}
