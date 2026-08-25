"use client";

// Form Check — on-device stroke analysis.
//
// Two ways in, one pipeline out:
//   live camera  -> usePoseStream collects frames in real time
//   video file   -> scanVideoFile seeks through a clip and collects the same
// Both hand a PoseFrame[] to analyzeStrokes, so the measurements and the
// coaching output are identical either way.
//
// Nothing is uploaded. The model runs in the browser and only the derived
// numbers are stored, never the footage.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Camera, Upload, Library, Loader2, Square,
  History, Trash2, AlertTriangle, Video as VideoIcon, Check,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useWakeLock } from "@/hooks/useWakeLock";
import { usePoseStream } from "@/hooks/usePoseStream";
import { PoseOverlay } from "@/components/technique/PoseOverlay";
import { FormCheckResults } from "@/components/technique/FormCheckResults";
import { scanVideoFile } from "@/lib/pose/detector";
import { analyzeStrokes, FAILURE_MESSAGES, type StrokeMetrics } from "@/lib/pose/analyze";
import type { PaddleSide, PoseFrame } from "@/lib/pose/landmarks";
import { buildFindings, overallScore } from "@/lib/pose/feedback";
import {
  saveFormCheck, getFormChecks, deleteFormCheck, previousCheck,
  type FormCheckResult, type FormCheckSource,
} from "@/lib/pose/history";
import { getAllVideoClips, type VideoClip } from "@/lib/video/db";

// ─── constants ───────────────────────────────────────────────────────────────

/** Below this the analysis has too few strokes to say anything useful. */
const MIN_CAPTURE_SEC = 15;
const TARGET_CAPTURE_SEC = 30;

type Screen =
  | { id: "home" }
  | { id: "camera" }
  | { id: "scanning"; label: string }
  | { id: "results"; metrics: StrokeMetrics; previous: FormCheckResult | null }
  | { id: "failed"; message: string }
  | { id: "clips" }
  | { id: "history" };

// ─── setup card ──────────────────────────────────────────────────────────────

function SideToggle({ side, onChange }: { side: PaddleSide; onChange: (s: PaddleSide) => void }) {
  return (
    <div className="flex items-center gap-2">
      {(["left", "right"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`flex-1 py-3 rounded-xl font-bold text-sm capitalize transition-colors ${
            side === s
              ? "bg-[#0EA5E9] text-white"
              : "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]"
          }`}
        >
          {s} side
        </button>
      ))}
    </div>
  );
}

function FramingTips() {
  return (
    <div className="bg-[#0B1220] border border-[#1E293B] rounded-2xl p-4">
      <div className="text-[#64748B] text-[10px] font-bold tracking-wide uppercase mb-2">
        For a reading that means anything
      </div>
      <ul className="text-[#94A3B8] text-sm space-y-1.5 leading-relaxed">
        <li>• Film from the <span className="text-white">side</span>, not front or back.</li>
        <li>• Fit your whole upper body and hips in frame.</li>
        <li>• Keep the phone still — prop it up rather than holding it.</li>
        <li>• Paddle steadily for at least {MIN_CAPTURE_SEC}s.</li>
        <li>• Same spot and distance each time, or the numbers won&apos;t compare.</li>
      </ul>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function FormCheckPage() {
  const [screen, setScreen] = useState<Screen>({ id: "home" });
  const [side, setSide] = useState<PaddleSide>("right");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<FormCheckResult[]>([]);
  const [clips, setClips] = useState<VideoClip[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { status: camStatus, streamRef, startCamera, stopCamera } = useCamera();
  const { acquire, release } = useWakeLock();
  const pose = usePoseStream();

  // ── shared: turn frames into a saved result ───────────────────────────────

  const finish = useCallback(
    async (frames: PoseFrame[], source: FormCheckSource, extra?: { clipId?: number; label?: string }) => {
      const result = analyzeStrokes(frames, side);
      if (!result.ok) {
        setScreen({ id: "failed", message: FAILURE_MESSAGES[result.reason] });
        return;
      }
      const createdAt = Date.now();
      const prev = await previousCheck(createdAt, side);
      const score = overallScore(buildFindings(result.metrics));

      await saveFormCheck({
        createdAt,
        date: new Date(createdAt).toISOString().split("T")[0],
        source,
        side,
        metrics: result.metrics,
        score,
        ...extra,
      });

      setScreen({ id: "results", metrics: result.metrics, previous: prev });
    },
    [side]
  );

  // ── live camera ───────────────────────────────────────────────────────────

  const openCamera = useCallback(async () => {
    setScreen({ id: "camera" });
    const stream = await startCamera("environment");
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      await pose.attach(videoRef.current);
    }
  }, [startCamera, pose]);

  const beginCapture = useCallback(async () => {
    await acquire();
    setElapsed(0);
    pose.startCapture();
  }, [acquire, pose]);

  const endCapture = useCallback(async () => {
    const frames = pose.stopCapture();
    await release();
    stopCamera();
    pose.detach();
    setScreen({ id: "scanning", label: "Analyzing your strokes" });
    await finish(frames, "camera");
  }, [pose, release, stopCamera, finish]);

  // Capture timer.
  useEffect(() => {
    if (pose.status !== "capturing") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [pose.status]);

  // Keep the preview bound if the stream arrives after the element mounts.
  useEffect(() => {
    if (screen.id === "camera" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [screen.id, streamRef]);

  // ── video file ────────────────────────────────────────────────────────────

  const scanSource = useCallback(
    async (source: Blob, label: string, sourceKind: FormCheckSource, clipId?: number) => {
      setProgress(0);
      setScreen({ id: "scanning", label });
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const { frames } = await scanVideoFile(source, {
          signal: ctrl.signal,
          onProgress: setProgress,
        });
        if (ctrl.signal.aborted) return;
        await finish(frames, sourceKind, { clipId, label });
      } catch (e) {
        setScreen({
          id: "failed",
          message: e instanceof Error ? e.message : "Could not read that video.",
        });
      } finally {
        abortRef.current = null;
      }
    },
    [finish]
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await scanSource(file, `Reading ${file.name}`, "file");
    },
    [scanSource]
  );

  // ── data loading ──────────────────────────────────────────────────────────

  const openHistory = useCallback(async () => {
    setHistory(await getFormChecks());
    setScreen({ id: "history" });
  }, []);

  const openClips = useCallback(async () => {
    setClips(await getAllVideoClips());
    setScreen({ id: "clips" });
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopCamera();
      release();
    };
  }, [stopCamera, release]);

  // ── chrome ────────────────────────────────────────────────────────────────

  const header = (title: string, sub?: string, back?: () => void) => (
    <div className="flex items-start gap-2 mb-5">
      {back ? (
        <button onClick={back} className="text-[#64748B] hover:text-white mt-1" aria-label="Back">
          <ChevronLeft size={22} />
        </button>
      ) : (
        <Link href="/technique" className="text-[#64748B] hover:text-white mt-1" aria-label="Back">
          <ChevronLeft size={22} />
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {sub && <p className="text-sm text-[#64748B] mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  // ── screens ───────────────────────────────────────────────────────────────

  if (screen.id === "camera") {
    const capturing = pose.status === "capturing";
    const loadingModel = pose.status === "loading-model";
    const longEnough = elapsed >= MIN_CAPTURE_SEC;

    // z-[60] must clear the dashboard's bottom nav, which is also fixed at
    // z-50 — at equal z-index the nav wins and swallows the capture controls.
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-[60]">
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />
          <PoseOverlay
            latestRef={pose.latestRef}
            side={side}
            className="absolute inset-0 pointer-events-none"
          />

          {(loadingModel || camStatus === "requesting") && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="text-[#0EA5E9] animate-spin" />
              <p className="text-white font-semibold">
                {loadingModel ? "Loading pose model…" : "Starting camera…"}
              </p>
              {loadingModel && (
                <p className="text-[#94A3B8] text-xs text-center px-10">
                  One-time download of about 17MB. It&apos;s cached afterwards and works offline.
                </p>
              )}
            </div>
          )}

          {pose.status === "error" && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertTriangle size={28} className="text-[#F87171]" />
              <p className="text-white font-semibold">Pose model failed to load</p>
              <p className="text-[#94A3B8] text-sm">{pose.error}</p>
            </div>
          )}

          {(camStatus === "denied" || camStatus === "no-camera" || camStatus === "unsupported") && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertTriangle size={28} className="text-[#F87171]" />
              <p className="text-white font-semibold">
                {camStatus === "denied" ? "Camera permission denied" : "No camera available"}
              </p>
              <p className="text-[#94A3B8] text-sm">
                You can still analyze a recorded video instead.
              </p>
              <button
                onClick={() => { stopCamera(); pose.detach(); setScreen({ id: "home" }); }}
                className="mt-2 bg-[#1E293B] text-white font-bold px-6 py-3 rounded-xl"
              >
                Go back
              </button>
            </div>
          )}

          {capturing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
              <span className="text-white font-bold tabular-nums">
                {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
              </span>
              <span className="text-[#94A3B8] text-xs">/ {TARGET_CAPTURE_SEC}s</span>
            </div>
          )}

          {!capturing && pose.status === "ready" && (
            <div className="absolute top-4 left-4 right-4 bg-black/60 rounded-xl px-4 py-3">
              <p className="text-white text-sm font-semibold">Film side-on, {side} side paddling</p>
              <p className="text-[#94A3B8] text-xs mt-0.5">
                The bright dot marks the wrist being tracked. If it&apos;s on the wrong hand, go back
                and switch sides.
              </p>
            </div>
          )}
        </div>

        <div className="bg-[#0B1220] px-6 py-5 flex items-center justify-between gap-4">
          <button
            onClick={() => { stopCamera(); pose.detach(); setScreen({ id: "home" }); }}
            className="text-[#94A3B8] font-semibold"
          >
            Cancel
          </button>

          {capturing ? (
            <button
              onClick={endCapture}
              disabled={!longEnough}
              className="flex items-center gap-2 bg-[#EF4444] disabled:bg-[#334155] disabled:text-[#64748B] text-white font-bold px-7 py-4 rounded-2xl transition-colors"
            >
              <Square size={16} fill="currentColor" />
              {longEnough ? "Stop & analyze" : `${MIN_CAPTURE_SEC - elapsed}s more`}
            </button>
          ) : (
            <button
              onClick={beginCapture}
              disabled={pose.status !== "ready"}
              className="flex items-center gap-2 bg-[#0EA5E9] disabled:opacity-50 text-white font-bold px-7 py-4 rounded-2xl"
            >
              <Camera size={18} /> Start
            </button>
          )}
          <span className="w-14" />
        </div>
      </div>
    );
  }

  if (screen.id === "scanning") {
    return (
      <div className="py-6 animate-fade-in">
        {header("Analyzing", screen.label)}
        <div className="flex flex-col items-center justify-center gap-5 py-16">
          <Loader2 size={32} className="text-[#0EA5E9] animate-spin" />
          <div className="w-full max-w-xs">
            <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0EA5E9] transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-[#64748B] text-xs text-center mt-2">
              {progress > 0 ? `${Math.round(progress * 100)}%` : "Reading frames…"}
            </p>
          </div>
          <p className="text-[#475569] text-xs text-center px-8">
            Running on your device. The video never leaves your phone.
          </p>
          <button
            onClick={() => { abortRef.current?.abort(); setScreen({ id: "home" }); }}
            className="text-[#94A3B8] text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (screen.id === "results") {
    return (
      <div className="py-6 animate-fade-in">
        {header("Form check", undefined, () => setScreen({ id: "home" }))}
        <FormCheckResults
          metrics={screen.metrics}
          previous={screen.previous}
          onRetake={() => setScreen({ id: "home" })}
          onDone={() => setScreen({ id: "home" })}
        />
      </div>
    );
  }

  if (screen.id === "failed") {
    return (
      <div className="py-6 animate-fade-in">
        {header("Couldn't analyze that", undefined, () => setScreen({ id: "home" }))}
        <div className="bg-[#111C2E] border border-[#1E293B] rounded-2xl p-5 flex flex-col items-center text-center gap-3">
          <AlertTriangle size={26} className="text-[#FBBF24]" />
          <p className="text-[#CBD5E1] text-sm leading-relaxed">{screen.message}</p>
        </div>
        <FramingTipsSpacer />
        <button
          onClick={() => setScreen({ id: "home" })}
          className="w-full mt-5 bg-[#0EA5E9] text-white font-bold py-4 rounded-2xl"
        >
          Try again
        </button>
      </div>
    );
  }

  if (screen.id === "clips") {
    return (
      <div className="py-6 animate-fade-in">
        {header("Pick a clip", "From your video library", () => setScreen({ id: "home" }))}
        {clips.length === 0 ? (
          <div className="text-center py-16">
            <VideoIcon size={28} className="text-[#334155] mx-auto mb-3" />
            <p className="text-[#64748B] text-sm">No clips saved yet.</p>
            <Link href="/technique/video" className="text-[#0EA5E9] text-sm font-semibold mt-2 inline-block">
              Record one first
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {clips.map((c) => (
              <button
                key={c.id}
                onClick={() => scanSource(c.blob, `Reading ${c.label}`, "clip", c.id)}
                className="flex items-center justify-between bg-[#111C2E] border border-[#1E293B] rounded-2xl p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{c.label}</div>
                  <div className="text-[#64748B] text-xs mt-0.5">
                    {c.category} · {c.date} · {Math.round(c.durationSec)}s
                  </div>
                </div>
                <ChevronLeft size={16} className="text-[#475569] rotate-180 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (screen.id === "history") {
    return (
      <div className="py-6 animate-fade-in">
        {header("Past checks", undefined, () => setScreen({ id: "home" }))}
        {history.length === 0 ? (
          <p className="text-[#64748B] text-sm text-center py-16">No form checks yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between bg-[#111C2E] border border-[#1E293B] rounded-2xl p-4"
              >
                <div>
                  <div className="text-white font-semibold">
                    {h.score} <span className="text-[#64748B] text-sm font-normal">score</span>
                  </div>
                  <div className="text-[#64748B] text-xs mt-0.5">
                    {h.date} · {h.side} side · {Math.round(h.metrics.strokeRateSpm)} spm ·{" "}
                    {h.metrics.strokeCount} strokes
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (h.id !== undefined) await deleteFormCheck(h.id);
                    setHistory(await getFormChecks());
                  }}
                  className="text-[#475569] hover:text-[#F87171] p-2"
                  aria-label="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── home ──────────────────────────────────────────────────────────────────

  return (
    <div className="py-6 animate-fade-in">
      {header("Form check", "Measure your stroke, on your device")}

      <div className="flex flex-col gap-5">
        <div>
          <div className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase mb-2">
            Which side do you paddle?
          </div>
          <SideToggle side={side} onChange={setSide} />
        </div>

        <FramingTips />

        <div className="flex flex-col gap-3">
          <button
            onClick={openCamera}
            className="flex items-center gap-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold px-5 py-4 rounded-2xl transition-colors"
          >
            <Camera size={20} />
            <span className="flex-1 text-left">
              Live camera
              <span className="block text-xs font-normal text-white/70">
                Watch the skeleton track you as you paddle
              </span>
            </span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 bg-[#111C2E] border border-[#1E293B] hover:bg-[#1E293B] text-white font-bold px-5 py-4 rounded-2xl transition-colors"
          >
            <Upload size={20} className="text-[#0EA5E9]" />
            <span className="flex-1 text-left">
              Analyze a video
              <span className="block text-xs font-normal text-[#64748B]">
                Someone films you once, you read it later
              </span>
            </span>
          </button>

          <button
            onClick={openClips}
            className="flex items-center gap-3 bg-[#111C2E] border border-[#1E293B] hover:bg-[#1E293B] text-white font-bold px-5 py-4 rounded-2xl transition-colors"
          >
            <Library size={20} className="text-[#0EA5E9]" />
            <span className="flex-1 text-left">
              From your clip library
              <span className="block text-xs font-normal text-[#64748B]">
                Re-read a clip you already recorded
              </span>
            </span>
          </button>

          <button
            onClick={openHistory}
            className="flex items-center gap-3 text-[#94A3B8] font-semibold px-5 py-3"
          >
            <History size={18} />
            Past checks
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFile}
        />

        <div className="flex gap-3 bg-[#0B1220] border border-[#1E293B] rounded-2xl p-4">
          <Check size={16} className="text-[#4ADE80] shrink-0 mt-0.5" />
          <p className="text-[#64748B] text-xs leading-relaxed">
            Everything runs in your browser. Your video is never uploaded, and only the measured
            numbers are saved on this device.
          </p>
        </div>
      </div>
    </div>
  );
}

function FramingTipsSpacer() {
  return (
    <div className="mt-5">
      <FramingTips />
    </div>
  );
}
