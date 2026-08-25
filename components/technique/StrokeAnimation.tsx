"use client";

// Animated stroke demonstration for the technique library.
//
// Draws the parametric stroke from lib/technique/stroke-model.ts onto a canvas,
// with the body parts relevant to the current lesson highlighted. Scrubbable, so
// a paddler can stop on the catch and look at it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import {
  poseAt, phaseAt, wrap, focusFor, PHASES, WATER_Y,
  type Highlight, type StrokePose, type Vec2,
} from "@/lib/technique/stroke-model";

const BONE = "#475569";
const BONE_LIT = "#0EA5E9";
const JOINT = "#94A3B8";
const SHAFT = "#CBD5E1";
const SHAFT_LIT = "#22D3EE";
const WATER = "#0C2436";
const WATER_LINE = "#164E63";
const HULL = "#15243B";
const HULL_EDGE = "#1E3A5F";

const SPEEDS = [0.25, 0.5, 1] as const;
type Speed = (typeof SPEEDS)[number];
const SPEED_LABEL: Record<Speed, string> = { 0.25: "¼×", 0.5: "½×", 1: "1×" };

/** One full stroke at 1× — about 60 spm, a realistic steady rate. */
const CYCLE_MS = 1000;

export function StrokeAnimation({ lessonId }: { lessonId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const focus = focusFor(lessonId);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(0.5);
  // Mirrors tRef for the UI; updated at a low rate so React isn't re-rendered
  // on every animation frame.
  const [displayT, setDisplayT] = useState(0);

  const playingRef = useRef(playing);
  const speedRef = useRef<Speed>(speed);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const draw = useCallback((pose: StrokePose, t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent?.clientWidth ?? 320;
    const h = Math.round(w * 0.62);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const W = canvas.width;
    const H = canvas.height;
    const px = (p: Vec2) => ({ x: p.x * W, y: p.y * H });
    const lit = new Set<Highlight>(focus?.highlights ?? []);

    ctx.clearRect(0, 0, W, H);

    // Water
    ctx.fillStyle = WATER;
    ctx.fillRect(0, WATER_Y * H, W, H - WATER_Y * H);
    ctx.strokeStyle = WATER_LINE;
    ctx.lineWidth = Math.max(1, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, WATER_Y * H);
    ctx.lineTo(W, WATER_Y * H);
    ctx.stroke();

    // Hull, drawn behind the paddler. Without it the figure reads as floating
    // in space rather than sitting in a boat, which makes the seated leg
    // position look like a mistake.
    const hullTop = WATER_Y * H - H * 0.055;
    const hullBottom = WATER_Y * H + H * 0.045;
    ctx.fillStyle = HULL;
    ctx.beginPath();
    ctx.moveTo(W * 0.12, hullTop);
    ctx.lineTo(W * 0.86, hullTop);
    ctx.quadraticCurveTo(W * 0.80, hullBottom, W * 0.62, hullBottom);
    ctx.lineTo(W * 0.34, hullBottom);
    ctx.quadraticCurveTo(W * 0.16, hullBottom, W * 0.12, hullTop);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HULL_EDGE;
    ctx.lineWidth = Math.max(1, W * 0.004);
    ctx.stroke();

    // Bench, drawn just under the hip so the paddler is clearly sitting on it.
    const benchY = (pose.hip.y + 0.022) * H;
    ctx.strokeStyle = HULL_EDGE;
    ctx.lineWidth = Math.max(2, W * 0.009);
    ctx.beginPath();
    ctx.moveTo(W * 0.495, benchY);
    ctx.lineTo(W * 0.625, benchY);
    ctx.stroke();

    const boneWidth = Math.max(2, W * 0.011);
    const line = (a: Vec2, b: Vec2, highlighted: boolean) => {
      const p = px(a), q = px(b);
      ctx.strokeStyle = highlighted ? BONE_LIT : BONE;
      ctx.lineWidth = highlighted ? boneWidth * 1.4 : boneWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    };

    // Legs and trunk
    line(pose.hip, pose.knee, lit.has("legs"));
    line(pose.knee, pose.ankle, lit.has("legs"));
    line(pose.shoulder, pose.hip, lit.has("torso"));
    // Neck — without it the head reads as a detached circle.
    line(pose.shoulder, pose.head, lit.has("torso"));

    // Arms
    line(pose.shoulder, pose.topElbow, lit.has("topArm"));
    line(pose.topElbow, pose.topHand, lit.has("topArm"));
    line(pose.shoulder, pose.bottomElbow, lit.has("bottomArm"));
    line(pose.bottomElbow, pose.bottomHand, lit.has("bottomArm"));

    // Paddle shaft and blade
    const bladeLit = lit.has("blade");
    const tp = px(pose.topHand), bt = px(pose.bladeTip);
    ctx.strokeStyle = bladeLit ? SHAFT_LIT : SHAFT;
    ctx.lineWidth = boneWidth * 0.9;
    ctx.beginPath();
    ctx.moveTo(tp.x, tp.y);
    ctx.lineTo(bt.x, bt.y);
    ctx.stroke();

    // Blade face
    const bh = px(pose.bottomHand);
    const dx = bt.x - bh.x, dy = bt.y - bh.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const halfW = W * 0.022;
    ctx.fillStyle = bladeLit ? SHAFT_LIT : SHAFT;
    ctx.beginPath();
    ctx.moveTo(bt.x + nx * halfW, bt.y + ny * halfW);
    ctx.lineTo(bt.x - nx * halfW, bt.y - ny * halfW);
    ctx.lineTo(bt.x - nx * halfW - dx * 0.42, bt.y - ny * halfW - dy * 0.42);
    ctx.lineTo(bt.x + nx * halfW - dx * 0.42, bt.y + ny * halfW - dy * 0.42);
    ctx.closePath();
    ctx.fill();

    // Head
    const hd = px(pose.head);
    ctx.fillStyle = JOINT;
    ctx.beginPath();
    ctx.arc(hd.x, hd.y, W * 0.032, 0, Math.PI * 2);
    ctx.fill();

    // Joints
    ctx.fillStyle = JOINT;
    for (const p of [pose.shoulder, pose.hip, pose.knee, pose.topElbow, pose.bottomElbow, pose.topHand, pose.bottomHand]) {
      const q = px(p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, boneWidth * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phase label
    ctx.fillStyle = "#64748B";
    ctx.font = `600 ${Math.round(W * 0.038)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(phaseAt(t).label.toUpperCase(), W * 0.035, H * 0.09);

    // Bow direction, so the view is unambiguous
    ctx.fillStyle = "#334155";
    ctx.font = `500 ${Math.round(W * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("← BOW", W * 0.035, H * 0.96);
  }, [focus]);

  // Animation loop.
  useEffect(() => {
    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      if (playingRef.current) {
        tRef.current = wrap(tRef.current + (dt * speedRef.current) / CYCLE_MS);
      }
      draw(poseAt(tRef.current), tRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [draw]);

  // Low-frequency mirror of the scrub position for the slider.
  useEffect(() => {
    const id = setInterval(() => setDisplayT(tRef.current), 100);
    return () => clearInterval(id);
  }, []);

  const jumpTo = useCallback((t: number) => {
    tRef.current = wrap(t);
    setDisplayT(tRef.current);
    draw(poseAt(tRef.current), tRef.current);
  }, [draw]);

  const showKeyMoment = useCallback(() => {
    if (!focus) return;
    setPlaying(false);
    jumpTo(focus.keyMoment);
  }, [focus, jumpTo]);

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0B1220] overflow-hidden">
      <div className="relative">
        <canvas ref={canvasRef} className="block w-full" />
      </div>

      {/* Scrub */}
      <div className="px-3 pt-2">
        <input
          type="range"
          min={0}
          max={999}
          value={Math.round(displayT * 1000)}
          onChange={(e) => { setPlaying(false); jumpTo(Number(e.target.value) / 1000); }}
          aria-label="Scrub through the stroke"
          className="w-full accent-[#0EA5E9]"
        />
        <div className="flex justify-between text-[9px] text-[#475569] -mt-1">
          {PHASES.map((p) => (
            <button
              key={p.phase}
              onClick={() => { setPlaying(false); jumpTo(p.at); }}
              className="hover:text-[#0EA5E9] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#0EA5E9] text-white shrink-0"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          className="px-3 h-9 rounded-xl bg-[#1E293B] text-[#94A3B8] text-xs font-bold shrink-0"
        >
          {SPEED_LABEL[speed]}
        </button>

        <button
          onClick={() => { setPlaying(true); jumpTo(0); }}
          aria-label="Restart"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1E293B] text-[#94A3B8] shrink-0"
        >
          <RotateCcw size={15} />
        </button>

        {focus && (
          <button
            onClick={showKeyMoment}
            className="flex-1 h-9 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#0EA5E9] text-xs font-bold transition-colors"
          >
            Show this lesson&apos;s moment
          </button>
        )}
      </div>

      {focus && (
        <p className="px-4 pb-4 text-xs text-[#94A3B8] leading-relaxed">{focus.caption}</p>
      )}

      <p className="px-4 pb-3 text-[10px] text-[#475569] leading-relaxed">
        An illustration of the stroke, not footage of a specific paddler — use it for the shape and
        sequence, and your coach for the detail.
      </p>
    </div>
  );
}
