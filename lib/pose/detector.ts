"use client";

// Thin wrapper around MediaPipe's PoseLandmarker.
//
// Everything here is browser-only and lazily imported, so nothing MediaPipe
// touches ends up in the server bundle. The wasm runtime and model weights are
// served from /mediapipe (staged by scripts/fetch-pose-assets.mjs) rather than
// Google's CDN, so form check keeps working offline in the PWA.

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame, Point } from "./landmarks";

export type ModelQuality = "lite" | "full";

const MODEL_PATH: Record<ModelQuality, string> = {
  lite: "/mediapipe/pose_landmarker_lite.task",
  full: "/mediapipe/pose_landmarker_full.task",
};

const WASM_PATH = "/mediapipe/wasm";

/**
 * Live preview runs `lite` to hold framerate on a phone. File analysis runs
 * `full`, where there is no realtime budget to blow and accuracy matters more.
 */
export const QUALITY_FOR: { live: ModelQuality; file: ModelQuality } = {
  live: "lite",
  file: "full",
};

const cache = new Map<string, Promise<PoseLandmarker>>();

/**
 * Loads a landmarker, reusing one per (quality, mode) pair. The wasm runtime is
 * ~11MB and the weights 5–9MB, so this must not be called per frame.
 */
export function loadPoseLandmarker(
  quality: ModelQuality,
  runningMode: "VIDEO" | "IMAGE" = "VIDEO"
): Promise<PoseLandmarker> {
  const key = `${quality}:${runningMode}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const p = (async () => {
    const { FilesetResolver, PoseLandmarker: PL } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    return PL.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH[quality], delegate: "GPU" },
      runningMode,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
  })();

  // Don't cache a rejected load — a retry should get a fresh attempt.
  p.catch(() => cache.delete(key));
  cache.set(key, p);
  return p;
}

/** True once the assets are in the HTTP cache and startup will be instant. */
export function isPoseModelLoaded(quality: ModelQuality, runningMode = "VIDEO"): boolean {
  return cache.has(`${quality}:${runningMode}`);
}

function toPoints(landmarks: Array<{ x: number; y: number; visibility?: number }>): Point[] {
  return landmarks.map((l) => ({ x: l.x, y: l.y, visibility: l.visibility }));
}

/** Runs one detection against a live video element. Returns null if no pose. */
export function detectFrame(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  tMs: number
): PoseFrame | null {
  const res = landmarker.detectForVideo(video, tMs);
  const first = res.landmarks?.[0];
  if (!first?.length) return null;
  return { tMs, landmarks: toPoints(first) };
}

// ─── file analysis ───────────────────────────────────────────────────────────

/** How often we sample a recorded clip. 20Hz is plenty to resolve a stroke. */
const FILE_SAMPLE_HZ = 20;

/** Stand-in for a frame where no pose was found, so misses still count. */
const BLANK_LANDMARKS: Point[] = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  visibility: 0,
}));

export interface FileScanOptions {
  /** 0..1, reported as the scan walks the clip. */
  onProgress?: (fraction: number) => void;
  /** Set to abort a scan early, e.g. when the user navigates away. */
  signal?: AbortSignal;
  quality?: ModelQuality;
}

function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = timeSec;
  });
}

function loadMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Video failed to load")), { once: true });
  });
}

/**
 * Walks a recorded clip and returns a pose frame per sample point.
 *
 * Seeks rather than plays: sampling is then independent of how fast the device
 * can decode, timestamps are exact, and a 30s clip doesn't take 30s to read.
 * Frames where no pose is found are still recorded as gaps by the caller —
 * analyzeStrokes uses the ratio to judge whether the clip was usable at all.
 */
export async function scanVideoFile(
  source: Blob | string,
  opts: FileScanOptions = {}
): Promise<{ frames: PoseFrame[]; sampledCount: number; durationSec: number }> {
  const { onProgress, signal, quality = QUALITY_FOR.file } = opts;

  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    const landmarker = await loadPoseLandmarker(quality, "VIDEO");
    await loadMetadata(video);

    const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
    if (!durationSec) throw new Error("Could not read video duration");

    const step = 1 / FILE_SAMPLE_HZ;
    const frames: PoseFrame[] = [];
    let sampledCount = 0;

    for (let t = 0; t < durationSec; t += step) {
      if (signal?.aborted) break;
      await seekTo(video, t);
      sampledCount++;

      // t only ever increases, so ms timestamps are already strictly increasing
      // — which is what detectForVideo requires.
      const tMs = Math.round(t * 1000);
      const f = detectFrame(landmarker, video, tMs);

      // Record a blank frame when nothing was found rather than skipping it.
      // analyzeStrokes judges a clip by the ratio of usable to total frames, so
      // dropping the misses here would make every clip look perfectly tracked.
      frames.push(f ?? { tMs, landmarks: BLANK_LANDMARKS });

      onProgress?.(Math.min(1, t / durationSec));
    }

    onProgress?.(1);
    return { frames, sampledCount, durationSec };
  } finally {
    video.src = "";
    video.removeAttribute("src");
    video.load();
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
