"use client";

// Draws the detected skeleton over the camera preview.
//
// Reads landmarks straight from a ref in its own animation-frame loop rather
// than taking them as props, so a 30fps stream never re-renders React.

import { useEffect, useRef } from "react";
import {
  POSE_EDGES,
  isVisible,
  bottomWrist,
  type PoseFrame,
  type PaddleSide,
} from "@/lib/pose/landmarks";

const BONE = "#0EA5E9";
const JOINT = "#E2E8F0";
const DRIVE = "#22D3EE";

export function PoseOverlay({
  latestRef,
  side,
  mirrored = false,
  className,
}: {
  latestRef: React.RefObject<PoseFrame | null>;
  side: PaddleSide;
  /** True when showing the front camera, whose preview is flipped. */
  mirrored?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Match the backing store to the displayed size so lines stay crisp.
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
      }

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const frame = latestRef.current;
      if (!frame) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const lms = frame.landmarks;
      const px = (x: number) => (mirrored ? (1 - x) * width : x * width);
      const py = (y: number) => y * height;

      ctx.lineWidth = Math.max(2, width * 0.006);
      ctx.lineCap = "round";
      ctx.strokeStyle = BONE;

      for (const [a, b] of POSE_EDGES) {
        const pa = lms[a];
        const pb = lms[b];
        if (!isVisible(pa) || !isVisible(pb)) continue;
        ctx.beginPath();
        ctx.moveTo(px(pa.x), py(pa.y));
        ctx.lineTo(px(pb.x), py(pb.y));
        ctx.stroke();
      }

      const r = Math.max(3, width * 0.008);
      for (const [a, b] of POSE_EDGES) {
        for (const i of [a, b]) {
          const p = lms[i];
          if (!isVisible(p)) continue;
          ctx.fillStyle = JOINT;
          ctx.beginPath();
          ctx.arc(px(p.x), py(p.y), r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Highlight the wrist the analysis actually tracks, so a misconfigured
      // paddling side is obvious on screen instead of silently skewing results.
      const bw = lms[bottomWrist(side)];
      if (isVisible(bw)) {
        ctx.fillStyle = DRIVE;
        ctx.beginPath();
        ctx.arc(px(bw.x), py(bw.y), r * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [latestRef, side, mirrored]);

  return <canvas ref={canvasRef} className={className} />;
}
