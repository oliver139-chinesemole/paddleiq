"use client";

// Live GPS tracking for water sessions.
//
// Browser geolocation only runs while the page is in the foreground — a PWA
// cannot track in the background, which is the one thing a native app does that
// this can't. A wake lock keeps the screen alive so a phone propped in the boat
// keeps recording, but a paddler who pockets it will lose the trace. The UI
// says so rather than pretending otherwise.

import { useCallback, useEffect, useRef, useState } from "react";
import { summarise, type Fix, type TrackStats } from "@/lib/gps/track";
import { useWakeLock } from "./useWakeLock";

export type GpsStatus =
  | "idle"
  | "requesting"
  | "tracking"
  | "denied"
  | "unavailable"
  | "error";

export const GPS_STATUS_MESSAGE: Record<Exclude<GpsStatus, "idle" | "tracking" | "requesting">, string> = {
  denied:
    "Location permission was denied. You can still enter distance and time by hand below.",
  unavailable:
    "This device or browser can't provide location. Enter distance and time by hand below.",
  error:
    "Couldn't start location tracking. Enter distance and time by hand below.",
};

/** Shown while tracking continues but the receiver has no current fix. */
export const SIGNAL_LOST_MESSAGE =
  "Searching for GPS… still recording, distance will catch up once the signal returns.";

export function useGpsTrack() {
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [stats, setStats] = useState<TrackStats>(() => summarise([]));
  /** Accuracy of the most recent fix, so the UI can show signal quality. */
  const [accuracy, setAccuracy] = useState<number | null>(null);
  /** True while the receiver has temporarily lost its fix — not a fatal state. */
  const [signalLost, setSignalLost] = useState(false);

  const fixesRef = useRef<Fix[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const { acquire, release } = useWakeLock();

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    void release();
    setStatus((s) => (s === "tracking" || s === "requesting" ? "idle" : s));
    return fixesRef.current;
  }, [release]);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    fixesRef.current = [];
    setStats(summarise([]));
    setAccuracy(null);
    setSignalLost(false);
    setStatus("requesting");
    await acquire();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        fixesRef.current.push({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          t: pos.timestamp,
        });
        setAccuracy(pos.coords.accuracy);
        setSignalLost(false);
        // Recomputed from the whole track rather than accumulated, so a fix
        // rejected by the filter can't leave distance behind it.
        setStats(summarise(fixesRef.current));
        setStatus("tracking");
      },
      (err) => {
        // Only a denied permission is unrecoverable. POSITION_UNAVAILABLE and
        // TIMEOUT happen constantly in normal use — under a bridge, between
        // fixes, before the first lock — and tearing the watch down on the
        // first one would make tracking useless on real water. Those just
        // raise a flag that the next good fix clears.
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          void release();
          return;
        }
        setSignalLost(true);
      },
      {
        enableHighAccuracy: true,
        // A stale fix is worse than none while moving.
        maximumAge: 0,
        timeout: 20_000,
      }
    );
  }, [acquire, release]);

  const reset = useCallback(() => {
    stop();
    fixesRef.current = [];
    setStats(summarise([]));
    setAccuracy(null);
    setSignalLost(false);
    setStatus("idle");
  }, [stop]);

  useEffect(() => () => { stop(); }, [stop]);

  return {
    status,
    stats,
    accuracy,
    signalLost,
    /** Raw fixes, for drawing the route or saving alongside the session. */
    fixes: fixesRef,
    start,
    stop,
    reset,
    isTracking: status === "tracking" || status === "requesting",
  };
}
