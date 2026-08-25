"use client";

// Draws the shape of a recorded route.
//
// Deliberately no basemap: map tiles are a third-party request, which breaks
// both the offline story and the CSP. The line on its own still answers the
// question a paddler is asking — did I hold a straight course, or wander?

import { useEffect, useRef } from "react";
import { toPolyline, type Fix } from "@/lib/gps/track";

const LINE = "#22D3EE";
const START = "#22C55E";
const END = "#EF4444";
const GRID = "#152238";

export function RouteMap({ fixes, className }: { fixes: Fix[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent?.clientWidth ?? 320;
    const h = Math.round(w * 0.6);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // A light grid, so a short track doesn't float in a void.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((W / 4) * i, 0); ctx.lineTo((W / 4) * i, H);
      ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i);
      ctx.stroke();
    }

    const pts = toPolyline(fixes);
    if (pts.length < 2) return;

    // Inset so the line and its end caps aren't clipped at the edges.
    const pad = Math.min(W, H) * 0.1;
    const px = (p: { x: number; y: number }) => ({
      x: pad + p.x * (W - pad * 2),
      y: pad + p.y * (H - pad * 2),
    });

    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(2, W * 0.008);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = px(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();

    const dot = (p: { x: number; y: number }, color: string) => {
      const q = px(p);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(3, W * 0.012), 0, Math.PI * 2);
      ctx.fill();
    };
    dot(pts[0], START);
    dot(pts[pts.length - 1], END);
  }, [fixes]);

  return <canvas ref={canvasRef} className={className} />;
}
