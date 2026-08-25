"use client";

// Drives live pose detection over a <video> element showing the camera.
//
// The detection loop runs at animation-frame rate, which is far too fast to
// push through React state — doing so would re-render the tree ~30 times a
// second. Instead the newest landmarks are written to a ref that the canvas
// overlay reads in its own loop, and React state carries only low-frequency
// things like status and stroke count.

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPoseLandmarker, detectFrame, QUALITY_FOR } from "@/lib/pose/detector";
import type { PoseFrame } from "@/lib/pose/landmarks";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

export type PoseStreamStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "capturing"
  | "error";

export function usePoseStream() {
  const [status, setStatus] = useState<PoseStreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** Frames captured so far — surfaced at 1Hz so the UI can show progress. */
  const [capturedCount, setCapturedCount] = useState(0);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(-1);
  const startedAtRef = useRef(0);

  /** Newest detection, for the overlay to render. Deliberately not state. */
  const latestRef = useRef<PoseFrame | null>(null);
  /** Accumulated frames for the current capture. */
  const framesRef = useRef<PoseFrame[]>([]);
  const capturingRef = useRef(false);

  const ensureModel = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setStatus("loading-model");
    setError(null);
    try {
      const lm = await loadPoseLandmarker(QUALITY_FOR.live, "VIDEO");
      landmarkerRef.current = lm;
      setStatus("ready");
      return lm;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the pose model");
      setStatus("error");
      return null;
    }
  }, []);

  // Named function expression so the body can reschedule itself by name —
  // referencing the `loop` binding here would read it before initialization.
  const loop = useCallback(function tick() {
    const video = videoRef.current;
    const lm = landmarkerRef.current;
    if (!video || !lm || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // MediaPipe rejects a repeated timestamp, which happens whenever the
    // display refreshes faster than the camera delivers frames.
    const tMs = Math.round(performance.now());
    if (tMs > lastTsRef.current) {
      lastTsRef.current = tMs;
      try {
        const f = detectFrame(lm, video, tMs);
        if (f) {
          latestRef.current = f;
          if (capturingRef.current) {
            framesRef.current.push({ ...f, tMs: tMs - startedAtRef.current });
          }
        } else if (capturingRef.current) {
          // Keep the miss so pose quality stays honest.
          framesRef.current.push({
            tMs: tMs - startedAtRef.current,
            landmarks: Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 })),
          });
        }
      } catch {
        // A single dropped frame is not worth tearing the stream down.
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /** Begins detection against a video element. Safe to call repeatedly. */
  const attach = useCallback(
    async (video: HTMLVideoElement) => {
      videoRef.current = video;
      const lm = await ensureModel();
      if (!lm) return;
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop);
    },
    [ensureModel, loop]
  );

  const startCapture = useCallback(() => {
    framesRef.current = [];
    startedAtRef.current = Math.round(performance.now());
    capturingRef.current = true;
    setCapturedCount(0);
    setStatus("capturing");
  }, []);

  const stopCapture = useCallback((): PoseFrame[] => {
    capturingRef.current = false;
    setStatus("ready");
    return framesRef.current;
  }, []);

  const detach = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    capturingRef.current = false;
    videoRef.current = null;
    latestRef.current = null;
  }, []);

  // Surface the running count without re-rendering on every frame.
  useEffect(() => {
    if (status !== "capturing") return;
    const id = setInterval(() => setCapturedCount(framesRef.current.length), 500);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => detach, [detach]);

  return {
    status,
    error,
    capturedCount,
    latestRef,
    attach,
    detach,
    startCapture,
    stopCapture,
  };
}
