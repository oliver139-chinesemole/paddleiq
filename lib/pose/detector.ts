"use client";

// Thin wrapper around MediaPipe's PoseLandmarker.
//
// Everything here is browser-only and lazily imported, so nothing MediaPipe
// touches ends up in the server bundle. The wasm runtime and model weights are
// served from /mediapipe (staged by scripts/fetch-pose-assets.mjs) rather than
// Google's CDN, so form check keeps working offline in the PWA.

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame, Point } from "./landmarks";
import type { MultiPoseFrame } from "./sync";

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

/**
 * Ceiling on paddlers tracked at once. Inference cost scales with this, and a
 * side-on shot of a boat rarely frames more than a few seats cleanly anyway.
 */
export const MAX_TRACKED_PADDLERS = 6;

const cache = new Map<string, Promise<PoseLandmarker>>();

/**
 * Loads a landmarker, reusing one per (quality, mode, numPoses) triple. The
 * wasm runtime is ~11MB and the weights 5–9MB, so this must not run per frame.
 */
export function loadPoseLandmarker(
  quality: ModelQuality,
  runningMode: "VIDEO" | "IMAGE" = "VIDEO",
  numPoses = 1
): Promise<PoseLandmarker> {
  const key = `${quality}:${runningMode}:${numPoses}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const p = (async () => {
    const { FilesetResolver, PoseLandmarker: PL } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    return PL.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH[quality], delegate: "GPU" },
      runningMode,
      numPoses,
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
export function isPoseModelLoaded(
  quality: ModelQuality,
  runningMode = "VIDEO",
  numPoses = 1
): boolean {
  return cache.has(`${quality}:${runningMode}:${numPoses}`);
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

/** Every paddler found in one frame. Empty `poses` means nobody was detected. */
export function detectFrameMulti(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  tMs: number
): MultiPoseFrame {
  const res = landmarker.detectForVideo(video, tMs);
  const poses = (res.landmarks ?? []).filter((l) => l?.length).map(toPoints);
  return { tMs, poses };
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
 * Walks a recorded clip, calling `extract` at each sample point.
 *
 * Seeks rather than plays: sampling is then independent of how fast the device
 * can decode, timestamps are exact, and a 30s clip doesn't take 30s to read.
 */
async function scanFrames<T>(
  source: Blob | string,
  numPoses: number,
  opts: FileScanOptions,
  extract: (lm: PoseLandmarker, video: HTMLVideoElement, tMs: number) => T
): Promise<{ frames: T[]; sampledCount: number; durationSec: number }> {
  const { onProgress, signal, quality = QUALITY_FOR.file } = opts;

  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    const landmarker = await loadPoseLandmarker(quality, "VIDEO", numPoses);
    await loadMetadata(video);

    const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
    if (!durationSec) throw new Error("Could not read video duration");

    const step = 1 / FILE_SAMPLE_HZ;
    const frames: T[] = [];
    let sampledCount = 0;

    for (let t = 0; t < durationSec; t += step) {
      if (signal?.aborted) break;
      await seekTo(video, t);
      sampledCount++;

      // t only ever increases, so ms timestamps are already strictly increasing
      // — which is what detectForVideo requires.
      frames.push(extract(landmarker, video, Math.round(t * 1000)));
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

/**
 * Single-paddler scan.
 *
 * Frames where no pose is found are recorded as blanks rather than skipped:
 * analyzeStrokes judges a clip by the ratio of usable to total frames, so
 * dropping the misses would make every clip look perfectly tracked.
 */
export function scanVideoFile(
  source: Blob | string,
  opts: FileScanOptions = {}
): Promise<{ frames: PoseFrame[]; sampledCount: number; durationSec: number }> {
  return scanFrames(source, 1, opts, (lm, video, tMs) =>
    detectFrame(lm, video, tMs) ?? { tMs, landmarks: BLANK_LANDMARKS }
  );
}

/** Multi-paddler scan, for reading crew timing off a boat video. */
export function scanVideoFileMulti(
  source: Blob | string,
  opts: FileScanOptions & { numPoses?: number } = {}
): Promise<{ frames: MultiPoseFrame[]; sampledCount: number; durationSec: number }> {
  const numPoses = Math.min(opts.numPoses ?? MAX_TRACKED_PADDLERS, MAX_TRACKED_PADDLERS);
  return scanFrames(source, numPoses, opts, detectFrameMulti);
}
