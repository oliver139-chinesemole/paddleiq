// MediaPipe BlazePose landmark indices.
// Full list: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker

export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

/** A single landmark in normalized image space: x/y in 0..1, origin top-left. */
export interface Point {
  x: number;
  y: number;
  /** MediaPipe's per-landmark visibility score, 0..1. Low means occluded/guessed. */
  visibility?: number;
}

/** One captured frame: 33 landmarks plus the timestamp they were sampled at. */
export interface PoseFrame {
  tMs: number;
  landmarks: Point[];
}

/**
 * Which side of the boat the paddler is on, from the camera's point of view.
 * Determines which wrist drives the stroke and which shoulder leads the reach.
 */
export type PaddleSide = "left" | "right";

/** Skeleton edges we draw in the overlay. Kept small — full BlazePose has 35. */
export const POSE_EDGES: ReadonlyArray<readonly [number, number]> = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
];

export const MIN_VISIBILITY = 0.5;

export function isVisible(p: Point | undefined): p is Point {
  return !!p && (p.visibility ?? 1) >= MIN_VISIBILITY;
}

/** Wrist landmark for the hand that grips the paddle low (the water-side hand). */
export function bottomWrist(side: PaddleSide): number {
  return side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
}

/** Wrist landmark for the hand on top of the grip. */
export function topWrist(side: PaddleSide): number {
  return side === "left" ? LM.RIGHT_WRIST : LM.LEFT_WRIST;
}

export function shoulderFor(side: PaddleSide): number {
  return side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
}

export function hipFor(side: PaddleSide): number {
  return side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
}
