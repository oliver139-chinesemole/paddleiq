// A parametric dragon boat stroke, for animated technique demonstrations.
//
// The technique library explains the stroke in words; this gives it a picture.
// Real reference footage would be better, but it has to come from somewhere —
// a diagram works offline, needs no rights to anyone's video, and can be
// annotated frame by frame in a way footage can't.
//
// Coordinates are normalised 0–1 in a side-on view with the bow to the LEFT,
// matching how Form Check asks you to film. The paddler is drawn as a skeleton
// plus a paddle shaft, so it reads the same way as the pose overlay.
//
// Pure — no canvas, no React.

export interface Vec2 {
  x: number;
  y: number;
}

/** The joints we draw. A side view hides one arm, so only one is modelled. */
export interface StrokePose {
  head: Vec2;
  shoulder: Vec2;
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  /** Upper hand, on top of the grip. */
  topHand: Vec2;
  topElbow: Vec2;
  /** Lower hand, near the blade. */
  bottomHand: Vec2;
  bottomElbow: Vec2;
  /** Tip of the blade, derived from the shaft line. */
  bladeTip: Vec2;
  /** True while the blade is in the water — the drive. */
  inWater: boolean;
}

export type StrokePhase = "catch" | "drive" | "exit" | "recovery";

export interface PhaseInfo {
  phase: StrokePhase;
  label: string;
  /** Where this phase begins, as a fraction of the cycle. */
  at: number;
}

/**
 * Phase boundaries. The drive occupies roughly the first half of the cycle and
 * the recovery the rest, which is about right for a steady racing stroke.
 */
export const PHASES: PhaseInfo[] = [
  { phase: "catch", label: "Catch", at: 0 },
  { phase: "drive", label: "Drive", at: 0.12 },
  { phase: "exit", label: "Exit", at: 0.46 },
  { phase: "recovery", label: "Recovery", at: 0.58 },
];

export function phaseAt(t: number): PhaseInfo {
  const x = wrap(t);
  let current = PHASES[0];
  for (const p of PHASES) if (x >= p.at) current = p;
  return current;
}

// ─── keyframes ───────────────────────────────────────────────────────────────

interface Keyframe {
  t: number;
  head: Vec2;
  shoulder: Vec2;
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  topHand: Vec2;
  bottomHand: Vec2;
  inWater: boolean;
}

/**
 * The stroke, as five poses.
 *
 * Chosen to match the cues in the lesson content: a long reach with the top arm
 * stacked overhead at the catch, the torso unwinding through the drive, and a
 * clean exit at the hip rather than past it.
 */
// The paddler is seated: hips on the bench above the waterline, legs forward
// and braced inside the hull. An earlier pass had the legs below WATER_Y, which
// drew them straight through the boat.
const KEYFRAMES: Keyframe[] = [
  {
    // Catch — maximum reach, torso wound forward, top arm stacked overhead.
    t: 0,
    head: { x: 0.455, y: 0.275 },
    shoulder: { x: 0.478, y: 0.375 },
    hip: { x: 0.545, y: 0.625 },
    knee: { x: 0.442, y: 0.648 },
    ankle: { x: 0.398, y: 0.700 },
    topHand: { x: 0.415, y: 0.190 },
    bottomHand: { x: 0.300, y: 0.500 },
    inWater: false,
  },
  {
    // Early drive — blade fully buried, trunk starting to unwind.
    t: 0.2,
    head: { x: 0.472, y: 0.280 },
    shoulder: { x: 0.497, y: 0.378 },
    hip: { x: 0.549, y: 0.625 },
    knee: { x: 0.445, y: 0.648 },
    ankle: { x: 0.398, y: 0.700 },
    topHand: { x: 0.470, y: 0.225 },
    bottomHand: { x: 0.385, y: 0.565 },
    inWater: true,
  },
  {
    // Exit — blade leaving the water level with the hip.
    t: 0.46,
    head: { x: 0.516, y: 0.288 },
    shoulder: { x: 0.538, y: 0.383 },
    hip: { x: 0.553, y: 0.625 },
    knee: { x: 0.448, y: 0.648 },
    ankle: { x: 0.398, y: 0.700 },
    topHand: { x: 0.550, y: 0.300 },
    bottomHand: { x: 0.545, y: 0.515 },
    inWater: true,
  },
  {
    // Recovery — hands lifted clear and travelling forward together.
    t: 0.72,
    head: { x: 0.486, y: 0.282 },
    shoulder: { x: 0.510, y: 0.380 },
    hip: { x: 0.549, y: 0.625 },
    knee: { x: 0.445, y: 0.648 },
    ankle: { x: 0.398, y: 0.700 },
    topHand: { x: 0.500, y: 0.250 },
    bottomHand: { x: 0.440, y: 0.460 },
    inWater: false,
  },
  {
    // Back to the catch, closing the loop.
    t: 1,
    head: { x: 0.455, y: 0.275 },
    shoulder: { x: 0.478, y: 0.375 },
    hip: { x: 0.545, y: 0.625 },
    knee: { x: 0.442, y: 0.648 },
    ankle: { x: 0.398, y: 0.700 },
    topHand: { x: 0.415, y: 0.190 },
    bottomHand: { x: 0.300, y: 0.500 },
    inWater: false,
  },
];

// ─── interpolation ───────────────────────────────────────────────────────────

/** Wraps any t into [0, 1), so the cycle loops cleanly. */
export function wrap(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const x = t % 1;
  return x < 0 ? x + 1 : x;
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpVec(a: Vec2, b: Vec2, k: number): Vec2 {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}

/** Smoothstep, so the joints ease rather than snapping between keyframes. */
function ease(k: number): number {
  return k * k * (3 - 2 * k);
}

/**
 * Elbow position, bent toward the paddler's front.
 *
 * Placing it on the midpoint would draw a straight arm through every phase,
 * which reads as a mannequin rather than a paddler. The bend is a *fraction of
 * arm length* rather than a fixed offset: a constant offset is a mild bend on
 * the long reach at the catch but a third of the arm at the exit, which folded
 * the limbs into a zigzag.
 */
function elbowFor(shoulder: Vec2, hand: Vec2, bendFactor: number): Vec2 {
  const mid = lerpVec(shoulder, hand, 0.5);
  // Offset perpendicular to the shoulder-hand line.
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = bendFactor * len;
  return { x: mid.x + (dy / len) * bend, y: mid.y - (dx / len) * bend };
}

/** Extends the shaft past the lower hand to give the blade. */
function bladeFor(topHand: Vec2, bottomHand: Vec2): Vec2 {
  const dx = bottomHand.x - topHand.x;
  const dy = bottomHand.y - topHand.y;
  const len = Math.hypot(dx, dy) || 1;
  const reach = 0.22;
  return { x: bottomHand.x + (dx / len) * reach, y: bottomHand.y + (dy / len) * reach };
}

/** The pose at any point in the cycle. `t` wraps, so it can be driven freely. */
export function poseAt(t: number): StrokePose {
  const x = wrap(t);

  let a = KEYFRAMES[0];
  let b = KEYFRAMES[1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (x >= KEYFRAMES[i].t && x <= KEYFRAMES[i + 1].t) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = b.t - a.t || 1;
  const k = ease((x - a.t) / span);

  const shoulder = lerpVec(a.shoulder, b.shoulder, k);
  const topHand = lerpVec(a.topHand, b.topHand, k);
  const bottomHand = lerpVec(a.bottomHand, b.bottomHand, k);

  return {
    head: lerpVec(a.head, b.head, k),
    shoulder,
    hip: lerpVec(a.hip, b.hip, k),
    knee: lerpVec(a.knee, b.knee, k),
    ankle: lerpVec(a.ankle, b.ankle, k),
    topHand,
    topElbow: elbowFor(shoulder, topHand, 0.16),
    bottomHand,
    bottomElbow: elbowFor(shoulder, bottomHand, -0.20),
    bladeTip: bladeFor(topHand, bottomHand),
    // The blade is in the water for the whole of the drive.
    inWater: k < 0.5 ? a.inWater : b.inWater,
  };
}

/** Waterline height, so the blade can be drawn entering and leaving. */
export const WATER_Y = 0.72;

// ─── per-lesson focus ────────────────────────────────────────────────────────

export type Highlight = "topArm" | "bottomArm" | "torso" | "blade" | "legs";

export interface LessonFocus {
  /** Where in the cycle to pause when demonstrating this lesson. */
  keyMoment: number;
  highlights: Highlight[];
  /** Shown under the animation at the key moment. */
  caption: string;
}

/**
 * Maps each technique lesson to the moment and body parts it's about, so the
 * animation demonstrates that lesson rather than just looping generically.
 * Keys are the lesson ids in lib/data/seed.ts.
 */
export const LESSON_FOCUS: Record<string, LessonFocus> = {
  t1: {
    keyMoment: 0,
    highlights: ["topArm", "bottomArm", "blade"],
    caption: "At the catch the blade is fully buried and well forward of the hip, with the top hand stacked above the shoulder.",
  },
  t2: {
    // Mid-drive: 0.1 sat just inside the catch band, so the caption talked
    // about unwinding while the label still read CATCH.
    keyMoment: 0.28,
    highlights: ["torso"],
    caption: "Power comes from the trunk unwinding, not the arms. Watch the shoulders rotate back toward square through the drive.",
  },
  t3: {
    keyMoment: 0.46,
    highlights: ["bottomArm", "blade"],
    caption: "The blade leaves the water level with the hip. Dragging it past that point pulls the boat down rather than forward.",
  },
  t4: {
    keyMoment: 0,
    highlights: ["blade"],
    caption: "Every paddler's blade should enter at the same instant. Time your catch to the stroke in front, not to the water.",
  },
  t5: {
    keyMoment: 0.2,
    highlights: ["bottomArm", "torso"],
    caption: "Race starts are short and deep: a compact stroke with full burial, before lengthening into race pace.",
  },
  t6: {
    keyMoment: 0.2,
    highlights: ["torso", "legs"],
    caption: "On the erg the same sequence applies — trunk first, arms last, with the legs braced rather than driving.",
  },
  t7: {
    keyMoment: 0.72,
    highlights: ["topArm"],
    caption: "Pacing lives in the recovery. Rushing the return forward shortens the next catch and burns energy.",
  },
  t8: {
    keyMoment: 0,
    highlights: ["topArm", "bottomArm"],
    caption: "Switching sides mirrors the stroke: the outside hand is always the one on top.",
  },
};

export function focusFor(lessonId: string): LessonFocus | null {
  return LESSON_FOCUS[lessonId] ?? null;
}
