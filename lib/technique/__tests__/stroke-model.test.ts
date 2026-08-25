/**
 * Unit tests for the parametric stroke.
 *
 * These pin the properties that make the animation read as paddling rather
 * than as a jittering stick figure: the cycle closes, joints move smoothly,
 * and the stroke actually goes forward-to-back through the water.
 */
import { describe, it, expect } from "vitest";
import {
  poseAt, phaseAt, wrap, lerp, focusFor, PHASES, LESSON_FOCUS, WATER_Y,
} from "../stroke-model";
import { techniqueLessons } from "@/lib/data/seed";

describe("wrap", () => {
  it("keeps t inside one cycle", () => {
    expect(wrap(0)).toBe(0);
    expect(wrap(0.5)).toBe(0.5);
    expect(wrap(1)).toBe(0);
    expect(wrap(1.25)).toBeCloseTo(0.25, 6);
  });

  it("wraps negatives forward", () => {
    expect(wrap(-0.25)).toBeCloseTo(0.75, 6);
  });

  it("falls back to zero for nonsense", () => {
    expect(wrap(NaN)).toBe(0);
    expect(wrap(Infinity)).toBe(0);
  });
});

describe("lerp", () => {
  it("interpolates between endpoints", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe("phaseAt", () => {
  it("names each part of the cycle", () => {
    expect(phaseAt(0).phase).toBe("catch");
    expect(phaseAt(0.3).phase).toBe("drive");
    expect(phaseAt(0.5).phase).toBe("exit");
    expect(phaseAt(0.8).phase).toBe("recovery");
  });

  it("always returns a phase, anywhere in the cycle", () => {
    for (let t = 0; t < 1; t += 0.01) {
      expect(PHASES.map((p) => p.phase)).toContain(phaseAt(t).phase);
    }
  });

  it("wraps like the pose does", () => {
    expect(phaseAt(1).phase).toBe(phaseAt(0).phase);
  });
});

describe("poseAt", () => {
  it("returns every joint with finite coordinates", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const p = poseAt(t);
      for (const [name, v] of Object.entries(p)) {
        if (name === "inWater") continue;
        const vec = v as { x: number; y: number };
        expect(Number.isFinite(vec.x), `${name}.x at t=${t}`).toBe(true);
        expect(Number.isFinite(vec.y), `${name}.y at t=${t}`).toBe(true);
      }
    }
  });

  it("keeps the paddler inside the frame", () => {
    for (let t = 0; t <= 1; t += 0.02) {
      const p = poseAt(t);
      for (const [name, v] of Object.entries(p)) {
        if (name === "inWater") continue;
        const vec = v as { x: number; y: number };
        expect(vec.x, `${name}.x at t=${t}`).toBeGreaterThanOrEqual(0);
        expect(vec.x, `${name}.x at t=${t}`).toBeLessThanOrEqual(1);
        expect(vec.y, `${name}.y at t=${t}`).toBeGreaterThanOrEqual(0);
        expect(vec.y, `${name}.y at t=${t}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("closes the loop so the animation doesn't jump", () => {
    const start = poseAt(0);
    const end = poseAt(0.9999);
    expect(end.bottomHand.x).toBeCloseTo(start.bottomHand.x, 2);
    expect(end.topHand.y).toBeCloseTo(start.topHand.y, 2);
  });

  it("moves the working hand from forward at the catch to back at the exit", () => {
    // Bow is to the left, so forward means a smaller x.
    const atCatch = poseAt(0).bottomHand.x;
    const atExit = poseAt(0.46).bottomHand.x;
    expect(atCatch).toBeLessThan(atExit);
  });

  it("reaches past the hip at the catch", () => {
    const p = poseAt(0);
    expect(p.bottomHand.x).toBeLessThan(p.hip.x);
  });

  it("exits level with the hip rather than well behind it", () => {
    const p = poseAt(0.46);
    expect(p.bottomHand.x).toBeGreaterThan(p.hip.x - 0.1);
    expect(p.bottomHand.x).toBeLessThan(p.hip.x + 0.1);
  });

  it("stacks the top hand above the shoulder at the catch", () => {
    const p = poseAt(0);
    // Canvas y grows downward, so higher means smaller.
    expect(p.topHand.y).toBeLessThan(p.shoulder.y);
  });

  it("buries the blade during the drive and lifts it on the recovery", () => {
    expect(poseAt(0.25).inWater).toBe(true);
    expect(poseAt(0.85).inWater).toBe(false);
  });

  it("puts the blade below the waterline while driving", () => {
    expect(poseAt(0.3).bladeTip.y).toBeGreaterThan(WATER_Y);
  });

  it("bends the arms rather than drawing them straight", () => {
    const p = poseAt(0.2);
    const straightY = (p.shoulder.y + p.bottomHand.y) / 2;
    expect(Math.abs(p.bottomElbow.y - straightY)).toBeGreaterThan(0.005);
  });

  it("moves smoothly, with no jumps between frames", () => {
    let prev = poseAt(0);
    for (let t = 0.01; t <= 1; t += 0.01) {
      const p = poseAt(t);
      const jump = Math.hypot(p.bottomHand.x - prev.bottomHand.x, p.bottomHand.y - prev.bottomHand.y);
      expect(jump, `jump at t=${t}`).toBeLessThan(0.05);
      prev = p;
    }
  });

  it("handles t outside the cycle by wrapping", () => {
    expect(poseAt(1.5).bottomHand.x).toBeCloseTo(poseAt(0.5).bottomHand.x, 6);
    expect(poseAt(-0.25).topHand.y).toBeCloseTo(poseAt(0.75).topHand.y, 6);
  });
});

describe("LESSON_FOCUS", () => {
  it("covers every lesson in the library", () => {
    for (const lesson of techniqueLessons) {
      expect(focusFor(lesson.id), `missing focus for ${lesson.id}`).not.toBeNull();
    }
  });

  it("points at a real moment in the cycle with a usable caption", () => {
    for (const [id, focus] of Object.entries(LESSON_FOCUS)) {
      expect(focus.keyMoment, id).toBeGreaterThanOrEqual(0);
      expect(focus.keyMoment, id).toBeLessThan(1);
      expect(focus.highlights.length, id).toBeGreaterThan(0);
      expect(focus.caption.length, id).toBeGreaterThan(30);
    }
  });

  it("returns null for an unknown lesson rather than throwing", () => {
    expect(focusFor("nope")).toBeNull();
  });

  it("pauses on a phase that matches what the caption describes", () => {
    // Regression: the rotation lesson paused at 0.1, which is still inside the
    // catch band, so the label read CATCH while the caption discussed the drive.
    const expected: Record<string, string> = {
      t1: "catch",     // The Catch
      t2: "drive",     // Torso Rotation — unwinding through the drive
      t3: "exit",      // The Exit
      t4: "catch",     // Timing — everyone catches together
      t5: "drive",     // Race Starts
      t6: "drive",     // Erg Technique
      t7: "recovery",  // Pacing lives in the recovery
      t8: "catch",     // Left vs right — mirrored at the catch
    };
    for (const [id, phase] of Object.entries(expected)) {
      const focus = focusFor(id)!;
      expect(phaseAt(focus.keyMoment).phase, `${id} pauses in the wrong phase`).toBe(phase);
    }
  });
});
