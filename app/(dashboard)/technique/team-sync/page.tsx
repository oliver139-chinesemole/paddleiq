"use client";

// Team Sync — measures how closely a crew catches together.
//
// Video-file only, deliberately. A paddler can't film their own boat while
// paddling it, so the realistic workflow is someone on the dock recording the
// crew side-on and the analysis happening afterwards.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Upload, Library, Loader2, AlertTriangle,
  Video as VideoIcon, Users,
} from "lucide-react";
import { TeamSyncResults } from "@/components/technique/TeamSyncResults";
import { scanVideoFileMulti, MAX_TRACKED_PADDLERS } from "@/lib/pose/detector";
import {
  analyzeTeamSync, SYNC_FAILURE_MESSAGES, type TeamSyncResult,
} from "@/lib/pose/sync";
import type { PaddleSide } from "@/lib/pose/landmarks";
import { getAllVideoClips, type VideoClip } from "@/lib/video/db";

type Screen =
  | { id: "home" }
  | { id: "scanning"; label: string }
  | { id: "results"; result: TeamSyncResult }
  | { id: "failed"; message: string }
  | { id: "clips" };

function SideToggle({ side, onChange }: { side: PaddleSide; onChange: (s: PaddleSide) => void }) {
  return (
    <div className="flex items-center gap-2">
      {(["left", "right"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`flex-1 py-3 rounded-xl font-bold text-sm capitalize transition-colors ${
            side === s ? "bg-[#0EA5E9] text-[#0A0F1E]" : "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]"
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
      <div className="text-[#8A98AC] text-[10px] font-bold tracking-wide uppercase mb-2">
        Filming the crew
      </div>
      <ul className="text-[#94A3B8] text-sm space-y-1.5 leading-relaxed">
        <li>• Shoot from the <span className="text-white">side of the boat</span> — a dock, a launch, or the bank.</li>
        <li>• Frame several seats at once. Up to {MAX_TRACKED_PADDLERS} are tracked.</li>
        <li>• Hold the camera still; panning shifts everyone at once and muddies the timing.</li>
        <li>• Capture at least 15 seconds of steady paddling at a settled rate.</li>
        <li>• All paddlers in frame should be on the same side.</li>
      </ul>
    </div>
  );
}

export default function TeamSyncPage() {
  const [screen, setScreen] = useState<Screen>({ id: "home" });
  const [side, setSide] = useState<PaddleSide>("right");
  const [progress, setProgress] = useState(0);
  const [clips, setClips] = useState<VideoClip[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scanSource = useCallback(
    async (source: Blob, label: string) => {
      setProgress(0);
      setScreen({ id: "scanning", label });
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const { frames } = await scanVideoFileMulti(source, {
          signal: ctrl.signal,
          onProgress: setProgress,
        });
        if (ctrl.signal.aborted) return;

        const analysis = analyzeTeamSync(frames, side);
        if (!analysis.ok) {
          setScreen({ id: "failed", message: SYNC_FAILURE_MESSAGES[analysis.reason] });
          return;
        }
        setScreen({ id: "results", result: analysis.result });
      } catch (e) {
        setScreen({
          id: "failed",
          message: e instanceof Error ? e.message : "Could not read that video.",
        });
      } finally {
        abortRef.current = null;
      }
    },
    [side]
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await scanSource(file, `Reading ${file.name}`);
    },
    [scanSource]
  );

  const openClips = useCallback(async () => {
    setClips(await getAllVideoClips());
    setScreen({ id: "clips" });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const header = (title: string, sub?: string, back?: () => void) => (
    <div className="flex items-start gap-2 mb-5">
      {back ? (
        <button onClick={back} className="text-[#8A98AC] hover:text-white mt-1" aria-label="Back">
          <ChevronLeft size={22} />
        </button>
      ) : (
        <Link href="/technique" className="text-[#8A98AC] hover:text-white mt-1" aria-label="Back">
          <ChevronLeft size={22} />
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {sub && <p className="text-sm text-[#8A98AC] mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (screen.id === "scanning") {
    return (
      <div className="py-6 animate-fade-in">
        {header("Analyzing crew", screen.label)}
        <div className="flex flex-col items-center justify-center gap-5 py-16">
          <Loader2 size={32} className="text-[#0EA5E9] animate-spin" />
          <div className="w-full max-w-xs">
            <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0EA5E9] transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-[#8A98AC] text-xs text-center mt-2">
              {progress > 0 ? `${Math.round(progress * 100)}%` : "Reading frames…"}
            </p>
          </div>
          <p className="text-[#7C8AA0] text-xs text-center px-8">
            Tracking up to {MAX_TRACKED_PADDLERS} paddlers takes longer than a single one. Runs
            entirely on your device.
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
        {header("Team sync", undefined, () => setScreen({ id: "home" }))}
        <TeamSyncResults
          result={screen.result}
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
        <div className="mt-5">
          <FramingTips />
        </div>
        <button
          onClick={() => setScreen({ id: "home" })}
          className="w-full mt-5 bg-[#0EA5E9] text-[#0A0F1E] font-bold py-4 rounded-2xl"
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
            <p className="text-[#8A98AC] text-sm">No clips saved yet.</p>
            <Link href="/technique/video" className="text-[#0EA5E9] text-sm font-semibold mt-2 inline-block">
              Record one first
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {clips.map((c) => (
              <button
                key={c.id}
                onClick={() => scanSource(c.blob, `Reading ${c.label}`)}
                className="flex items-center justify-between bg-[#111C2E] border border-[#1E293B] rounded-2xl p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{c.label}</div>
                  <div className="text-[#8A98AC] text-xs mt-0.5">
                    {c.category} · {c.date} · {Math.round(c.durationSec)}s
                  </div>
                </div>
                <ChevronLeft size={16} className="text-[#7C8AA0] rotate-180 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-6 animate-fade-in">
      {header("Team sync", "Measure how together your crew catches")}

      <div className="flex flex-col gap-5">
        <div className="flex gap-3 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-2xl p-4">
          <Users size={18} className="text-[#0EA5E9] shrink-0 mt-0.5" />
          <p className="text-[#CBD5E1] text-sm leading-relaxed">
            Timing spread of 40ms is invisible from the dock but very visible in hull speed. This
            reads each paddler&apos;s catch from a side-on video and shows who is ahead of the crew
            and who is behind.
          </p>
        </div>

        <div>
          <div className="text-[#94A3B8] text-xs font-semibold tracking-wide uppercase mb-2">
            Which side is in frame?
          </div>
          <SideToggle side={side} onChange={setSide} />
        </div>

        <FramingTips />

        <div className="flex flex-col gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-[#0A0F1E] font-bold px-5 py-4 rounded-2xl transition-colors"
          >
            <Upload size={20} />
            <span className="flex-1 text-left">
              Analyze a boat video
              <span className="block text-xs font-normal text-[#0A0F1E]/75">
                Upload footage of the crew from the side
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
              <span className="block text-xs font-normal text-[#8A98AC]">
                Re-read a clip you already recorded
              </span>
            </span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
