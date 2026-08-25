"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, FlipHorizontal, Library, Play, Pause,
  SkipBack, SkipForward, Check, X, Download, Trash2,
  Video, Search, Upload, Camera,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useRecorder } from "@/hooks/useRecorder";
import {
  saveVideoClip, getAllVideoClips, getVideoClip, deleteVideoClip,
  VIDEO_CATEGORIES, type VideoClip, type VideoCategory,
} from "@/lib/video/db";
import { extForMime, shouldUseIOSFallback } from "@/lib/video/codec";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Speed = 0.25 | 0.5 | 1;
const SPEEDS: Speed[] = [0.25, 0.5, 1];
const SPEED_LABELS: Record<Speed, string> = { 0.25: "¼×", 0.5: "½×", 1: "1×" };

// ─── screen type ─────────────────────────────────────────────────────────────

type Screen =
  | { id: "library" }
  | { id: "camera" }
  | { id: "ios-fallback" }
  | { id: "error"; reason: "denied" | "no-camera" | "unsupported" }
  | { id: "playback"; blob: Blob; mimeType: string; durationSec: number }
  | { id: "save"; blob: Blob; mimeType: string; durationSec: number }
  | { id: "detail"; clipId: number };

// ─── iOS fallback ─────────────────────────────────────────────────────────────

function IOSFallbackView({ onDone }: { onDone: (b: Blob, m: string, d: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const dur = await new Promise<number>((res) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      const url = URL.createObjectURL(file);
      v.onloadedmetadata = () => { URL.revokeObjectURL(url); res(isFinite(v.duration) ? v.duration : 0); };
      v.onerror = () => { URL.revokeObjectURL(url); res(0); };
      v.src = url;
    });
    setLoading(false);
    onDone(file, file.type || "video/mp4", dur);
  }
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0EA5E9]/20 flex items-center justify-center">
        <Video size={28} className="text-[#0EA5E9]" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Record with your camera</h2>
        <p className="text-[#8A98AC] text-sm">Tap below to open the native camera, record your clip, then return to review it.</p>
        <p className="text-[#7C8AA0] text-xs mt-1">(Native capture — most reliable on iPhone)</p>
      </div>
      <input ref={inputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 text-white font-bold px-8 py-4 rounded-2xl transition-colors"
      >
        {loading
          ? <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          : <><Upload size={18} /> Open Camera</>}
      </button>
    </div>
  );
}

// ─── camera + live recorder ───────────────────────────────────────────────────

function CameraView({
  onDone,
  onError,
  onLibrary,
}: {
  onDone: (b: Blob, m: string, d: number) => void;
  onError: (r: "denied" | "no-camera" | "unsupported") => void;
  onLibrary: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, facing, streamRef, startCamera, stopCamera, flipCamera } = useCamera();
  const { isRecording, elapsedSec, startRecording, stopRecording } = useRecorder();
  const pendingRef = useRef<Promise<{ blob: Blob; mimeType: string; durationSec: number }> | null>(null);

  useEffect(() => {
    startCamera("environment").then((stream) => {
      if (stream && videoRef.current) videoRef.current.srcObject = stream;
    });
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (streamRef.current && videoRef.current) videoRef.current.srcObject = streamRef.current;
  }, [facing, streamRef]);

  useEffect(() => {
    if (status === "denied") onError("denied");
    else if (status === "no-camera") onError("no-camera");
    else if (status === "unsupported") onError("unsupported");
  }, [status, onError]);

  const handleFlip = useCallback(async () => {
    if (isRecording) return;
    const stream = await flipCamera();
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [flipCamera, isRecording]);

  const handleToggle = useCallback(async () => {
    if (!streamRef.current) return;
    if (!isRecording) {
      pendingRef.current = startRecording(streamRef.current);
    } else {
      stopRecording();
      if (pendingRef.current) {
        const r = await pendingRef.current;
        pendingRef.current = null;
        onDone(r.blob, r.mimeType, r.durationSec);
      }
    }
  }, [isRecording, startRecording, stopRecording, streamRef, onDone]);

  return (
    <div className="relative flex-1 bg-black overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

      {status === "requesting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="w-10 h-10 rounded-full border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] animate-spin" />
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-4 pb-2">
        {isRecording ? (
          <div className="flex items-center gap-2 bg-black/50 rounded-full px-3 py-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-mono font-bold">{fmtTime(elapsedSec)}</span>
          </div>
        ) : <div className="w-20" />}
        <button onClick={onLibrary} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
          <Library size={19} className="text-white" />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-6 flex items-center justify-around px-10">
        <button
          onClick={handleFlip}
          disabled={isRecording}
          className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center disabled:opacity-30"
        >
          <FlipHorizontal size={22} className="text-white" />
        </button>

        <button onClick={handleToggle} className="active:scale-90 transition-transform">
          {isRecording ? (
            <div className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center">
              <div className="w-7 h-7 rounded-md bg-red-500" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white" />
            </div>
          )}
        </button>

        <div className="w-12 h-12" />
      </div>

      {facing === "user" && !isRecording && (
        <div className="absolute top-20 inset-x-0 flex justify-center">
          <span className="text-xs text-white/40 bg-black/30 px-2 py-0.5 rounded-full">Front camera</span>
        </div>
      )}
    </div>
  );
}

// ─── playback ─────────────────────────────────────────────────────────────────

function PlaybackView({
  blob, durationSec, onKeep, onDiscard,
}: { blob: Blob; mimeType: string; durationSec: number; onKeep: () => void; onDiscard: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [objectUrl] = useState(() => URL.createObjectURL(blob));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState(durationSec);
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    // play() rejects when a pause interrupts it, which is routine when tapping
    // quickly; swallowing that is intentional, letting it float is not.
    if (playing) v.pause();
    else void v.play().catch(() => {});
  };
  const step = (d: 1 | -1) => { const v = videoRef.current!; v.pause(); v.currentTime = Math.max(0, Math.min(v.currentTime + d / 30, dur)); };
  const cycleSpeed = () => {
    const v = videoRef.current!;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    v.playbackRate = next;
  };

  return (
    <div className="flex flex-col flex-1 bg-black">
      <div className="flex-1 flex items-center justify-center">
        <video
          ref={videoRef} src={objectUrl} playsInline
          className="max-h-full max-w-full object-contain"
          onLoadedMetadata={(e) => { const v = e.currentTarget; setDur(isFinite(v.duration) ? v.duration : durationSec); }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
      <div className="bg-[#0D1528] px-5 pt-4 pb-8 space-y-4">
        {/* Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8A98AC] font-mono w-10 text-right">{fmtTime(current)}</span>
          <input type="range" min={0} max={dur || 1} step={0.033} value={current}
            onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = +e.target.value; }}
            className="flex-1 accent-[#0EA5E9]" />
          <span className="text-xs text-[#8A98AC] font-mono w-10">{fmtTime(dur)}</span>
        </div>
        {/* Controls */}
        <div className="flex items-center justify-between">
          <button onClick={() => step(-1)} className="w-11 h-11 rounded-full bg-[#1E293B] flex items-center justify-center">
            <SkipBack size={18} className="text-[#94A3B8]" />
          </button>
          <button onClick={toggle} className="w-16 h-16 rounded-full bg-[#0EA5E9] flex items-center justify-center shadow-lg shadow-[#0EA5E9]/25 active:scale-95 transition-transform">
            {playing ? <Pause size={26} className="text-white" /> : <Play size={26} className="text-white ml-1" />}
          </button>
          <button onClick={() => step(1)} className="w-11 h-11 rounded-full bg-[#1E293B] flex items-center justify-center">
            <SkipForward size={18} className="text-[#94A3B8]" />
          </button>
        </div>
        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={onDiscard} className="flex items-center gap-1.5 text-sm text-[#8A98AC] hover:text-red-400 transition-colors">
            <X size={16} /> Discard
          </button>
          <button onClick={cycleSpeed} className="px-4 py-1.5 rounded-full bg-[#1E293B] text-sm font-bold text-white">
            {SPEED_LABELS[speed]}
          </button>
          <button onClick={onKeep} className="flex items-center gap-1.5 text-sm text-[#0EA5E9] font-semibold hover:text-[#38BDF8] transition-colors">
            <Check size={16} /> Keep &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── save form ────────────────────────────────────────────────────────────────

function SaveView({
  durationSec, onSave, onBack,
}: { durationSec: number; onSave: (m: { label: string; category: VideoCategory; notes: string }) => void; onBack: () => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<VideoCategory>("Full Stroke");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({ label: label.trim() || "Untitled clip", category, notes });
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto bg-[#0A0F1E]">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#1E293B]">
        <button onClick={onBack} className="text-[#8A98AC] hover:text-white"><ChevronLeft size={22} /></button>
        <div>
          <h2 className="text-base font-bold text-white">Save Clip</h2>
          <p className="text-xs text-[#8A98AC]">{fmtTime(durationSec)} · {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-5">
        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wide">Label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Catch drill — Tuesday session"
            className="w-full bg-[#111827] border border-[#1E293B] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#7C8AA0] outline-none focus:border-[#0EA5E9] transition-colors" />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wide">Technique Focus</label>
          <div className="flex flex-wrap gap-2">
            {VIDEO_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  category === cat ? "bg-[#0EA5E9] text-[#0A0F1E]" : "bg-[#1E293B] text-[#8A98AC] hover:bg-[#334155]"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wide">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="What were you working on? What did you notice?"
            rows={3}
            className="w-full bg-[#111827] border border-[#1E293B] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#7C8AA0] outline-none focus:border-[#0EA5E9] transition-colors resize-none" />
        </div>
      </div>

      <div className="px-5 pb-8 pt-3 border-t border-[#1E293B]">
        <button onClick={submit} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-colors">
          {saving
            ? <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : <><Check size={18} /> Save Clip</>}
        </button>
      </div>
    </div>
  );
}

// ─── library ──────────────────────────────────────────────────────────────────

function LibraryView({ onRecord, onDetail }: { onRecord: () => void; onDetail: (id: number) => void }) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    getAllVideoClips().then((all) => { setClips(all); setLoading(false); });
  }, []);

  const filtered = query
    ? clips.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase()) ||
        c.notes.toLowerCase().includes(query.toLowerCase()))
    : clips;

  function download(clip: VideoClip) {
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clip.label.replace(/\s+/g, "_")}.${extForMime(clip.mimeType)}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: number) {
    await deleteVideoClip(id);
    setClips((p) => p.filter((c) => c.id !== id));
    setConfirmId(null);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0A0F1E]">
      {/* Search + record */}
      <div className="px-4 py-3 space-y-3 border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7C8AA0]" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clips…"
              className="w-full bg-[#111827] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#7C8AA0] outline-none focus:border-[#0EA5E9]" />
          </div>
          <button onClick={onRecord}
            className="flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-[#0A0F1E] text-sm font-semibold px-4 py-2 rounded-xl shrink-0 transition-colors">
            <Camera size={15} /> Record
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 rounded-full border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-[#1E293B] flex items-center justify-center">
              <Video size={24} className="text-[#7C8AA0]" />
            </div>
            <div>
              <p className="text-white font-semibold">{query ? "No clips match" : "No clips yet"}</p>
              <p className="text-[#8A98AC] text-sm mt-1">
                {query ? "Try a different search." : "Record your first technique clip to get started."}
              </p>
            </div>
            {!query && (
              <button onClick={onRecord} className="bg-[#0EA5E9] text-[#0A0F1E] font-semibold px-6 py-2.5 rounded-xl text-sm">
                Record Now
              </button>
            )}
          </div>
        )}

        {filtered.map((clip) => (
          <div key={clip.id} className="border-b border-[#1E293B] px-4 py-3.5">
            <div className="flex items-start gap-3">
              <button
                onClick={() => clip.id != null && onDetail(clip.id)}
                className="w-16 h-12 rounded-xl bg-[#1E293B] flex items-center justify-center shrink-0 hover:bg-[#334155] transition-colors">
                <Play size={16} className="text-[#0EA5E9] ml-0.5" />
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => clip.id != null && onDetail(clip.id)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">{clip.label}</span>
                  <span className="text-[10px] font-semibold bg-[#0EA5E9]/15 text-[#0EA5E9] px-2 py-0.5 rounded-full shrink-0">
                    {clip.category}
                  </span>
                </div>
                <p className="text-xs text-[#7C8AA0] mt-0.5">{clip.date} · {fmtTime(clip.durationSec)}</p>
                {clip.notes && <p className="text-xs text-[#8A98AC] mt-1 line-clamp-1">{clip.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => download(clip)} className="text-[#7C8AA0] hover:text-[#0EA5E9] transition-colors"><Download size={17} /></button>
                <button onClick={() => setConfirmId(clip.id ?? null)} className="text-[#7C8AA0] hover:text-red-400 transition-colors"><Trash2 size={17} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {confirmId !== null && (
        <div className="absolute inset-0 bg-black/70 flex items-end z-50">
          <div className="w-full bg-[#0D1528] rounded-t-3xl p-6 space-y-3">
            <p className="text-white font-bold text-center">Delete this clip?</p>
            <button onClick={() => remove(confirmId)} className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold">Delete</button>
            <button onClick={() => setConfirmId(null)} className="w-full py-3 rounded-2xl bg-[#1E293B] text-white font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── clip detail ──────────────────────────────────────────────────────────────

function DetailView({ clipId, onBack }: { clipId: number; onBack: () => void }) {
  const [clip, setClip] = useState<VideoClip | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    getVideoClip(clipId).then((c) => {
      if (c) { setClip(c); setDur(c.durationSec); setUrl(URL.createObjectURL(c.blob)); }
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    // play() rejects when a pause interrupts it, which is routine when tapping
    // quickly; swallowing that is intentional, letting it float is not.
    if (playing) v.pause();
    else void v.play().catch(() => {});
  };
  const step = (d: 1 | -1) => { const v = videoRef.current!; v.pause(); v.currentTime = Math.max(0, Math.min(v.currentTime + d / 30, dur)); };
  const cycleSpeed = () => {
    const v = videoRef.current!;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    v.playbackRate = next;
  };
  const download = () => {
    if (!clip || !url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clip.label.replace(/\s+/g, "_")}.${extForMime(clip.mimeType)}`;
    a.click();
  };
  async function handleDelete() {
    await deleteVideoClip(clipId);
    onBack();
  }

  if (!clip || !url) return (
    <div className="flex items-center justify-center flex-1 bg-[#0A0F1E]">
      <div className="w-8 h-8 rounded-full border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-black relative">
      {/* Video */}
      <div className="flex-1 flex items-center justify-center relative">
        <video ref={videoRef} src={url} playsInline className="max-h-full max-w-full object-contain"
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || clip.durationSec)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        {/* header overlay */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 pb-3 bg-gradient-to-b from-black/70 to-transparent">
          <button onClick={onBack} className="text-white"><ChevronLeft size={26} /></button>
          <div className="flex gap-3">
            <button onClick={download} className="text-white/80 hover:text-white"><Download size={20} /></button>
            <button onClick={() => setConfirmDel(true)} className="text-white/80 hover:text-red-400"><Trash2 size={20} /></button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#0D1528] px-5 pt-4 pb-8 space-y-3">
        <div>
          <p className="text-white font-bold text-sm">{clip.label}</p>
          <p className="text-[#8A98AC] text-xs">{clip.category} · {clip.date} · {fmtTime(clip.durationSec)}</p>
          {clip.notes && <p className="text-[#94A3B8] text-xs mt-1 leading-relaxed">{clip.notes}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8A98AC] font-mono w-10 text-right">{fmtTime(current)}</span>
          <input type="range" min={0} max={dur || 1} step={0.033} value={current}
            onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = +e.target.value; }}
            className="flex-1 accent-[#0EA5E9]" />
          <span className="text-xs text-[#8A98AC] font-mono w-10">{fmtTime(dur)}</span>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => step(-1)} className="w-11 h-11 rounded-full bg-[#1E293B] flex items-center justify-center"><SkipBack size={18} className="text-[#94A3B8]" /></button>
          <button onClick={toggle} className="w-16 h-16 rounded-full bg-[#0EA5E9] flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-[#0EA5E9]/25">
            {playing ? <Pause size={26} className="text-white" /> : <Play size={26} className="text-white ml-1" />}
          </button>
          <button onClick={() => step(1)} className="w-11 h-11 rounded-full bg-[#1E293B] flex items-center justify-center"><SkipForward size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="flex justify-center">
          <button onClick={cycleSpeed} className="px-5 py-1.5 rounded-full bg-[#1E293B] text-sm font-bold text-white">{SPEED_LABELS[speed]}</button>
        </div>
      </div>

      {confirmDel && (
        <div className="absolute inset-0 bg-black/70 flex items-end z-50">
          <div className="w-full bg-[#0D1528] rounded-t-3xl p-6 space-y-3">
            <p className="text-white font-bold text-center">Delete &ldquo;{clip.label}&rdquo;?</p>
            <button onClick={handleDelete} className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold">Delete</button>
            <button onClick={() => setConfirmDel(false)} className="w-full py-3 rounded-2xl bg-[#1E293B] text-white font-semibold">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── error ────────────────────────────────────────────────────────────────────

function ErrorView({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  const msgs: Record<string, { title: string; body: string }> = {
    denied: { title: "Camera access denied", body: "Allow camera and microphone access in your browser settings, then tap Retry." },
    "no-camera": { title: "No camera found", body: "This device doesn't have an accessible camera." },
    unsupported: { title: "Camera not supported", body: "Try opening this page in Safari (iOS) or Chrome (Android)." },
  };
  const { title, body } = msgs[reason] ?? msgs.unsupported;
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 px-8 text-center">
      <div className="w-14 h-14 rounded-full bg-red-900/30 flex items-center justify-center">
        <Camera size={26} className="text-red-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
        <p className="text-[#8A98AC] text-sm leading-relaxed">{body}</p>
      </div>
      <button onClick={onRetry} className="bg-[#0EA5E9] text-[#0A0F1E] font-bold px-8 py-3 rounded-2xl">Retry</button>
    </div>
  );
}

// ─── root page ────────────────────────────────────────────────────────────────

export default function VideoReviewPage() {
  const [screen, setScreen] = useState<Screen>({ id: "library" });
  const pendingBlob = useRef<Blob | null>(null);
  const pendingMime = useRef("");
  const pendingDur = useRef(0);

  function onRecordingDone(blob: Blob, mimeType: string, durationSec: number) {
    pendingBlob.current = blob;
    pendingMime.current = mimeType;
    pendingDur.current = durationSec;
    setScreen({ id: "playback", blob, mimeType, durationSec });
  }

  async function onSaveClip(meta: { label: string; category: VideoCategory; notes: string }) {
    if (!pendingBlob.current) return;
    await saveVideoClip({
      ...meta,
      date: new Date().toLocaleDateString("en-CA"),
      durationSec: pendingDur.current,
      mimeType: pendingMime.current,
      blob: pendingBlob.current,
      createdAt: Date.now(),
    });
    setScreen({ id: "library" });
  }

  const useIOS = shouldUseIOSFallback();

  // Full-screen screens (no dashboard chrome) — return without the page wrapper
  if (screen.id === "camera") {
    if (useIOS) return (
      <div className="fixed inset-0 bg-[#0A0F1E] flex flex-col z-50">
        <div className="flex items-center gap-3 px-5 pt-6 pb-3 border-b border-[#1E293B]">
          <button onClick={() => setScreen({ id: "library" })} className="text-[#8A98AC]"><ChevronLeft size={22} /></button>
          <h2 className="text-base font-bold text-white">Record</h2>
        </div>
        <IOSFallbackView onDone={onRecordingDone} />
      </div>
    );
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-50">
        <div className="absolute top-4 left-4 z-10">
          <button onClick={() => setScreen({ id: "library" })} className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
            <ChevronLeft size={20} className="text-white" />
          </button>
        </div>
        <CameraView
          onDone={onRecordingDone}
          onError={(r) => setScreen({ id: "error", reason: r })}
          onLibrary={() => setScreen({ id: "library" })}
        />
      </div>
    );
  }

  if (screen.id === "playback") return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      <div className="flex items-center gap-3 px-5 pt-6 pb-3 bg-[#0D1528] border-b border-[#1E293B]">
        <button onClick={() => setScreen({ id: "camera" })} className="text-[#8A98AC]"><ChevronLeft size={22} /></button>
        <h2 className="text-base font-bold text-white">Review Clip</h2>
      </div>
      <PlaybackView
        blob={screen.blob} mimeType={screen.mimeType} durationSec={screen.durationSec}
        onKeep={() => setScreen({ id: "save", blob: screen.blob, mimeType: screen.mimeType, durationSec: screen.durationSec })}
        onDiscard={() => setScreen({ id: "camera" })}
      />
    </div>
  );

  if (screen.id === "save") return (
    <div className="fixed inset-0 flex flex-col z-50">
      <SaveView
        durationSec={screen.durationSec}
        onSave={onSaveClip}
        onBack={() => setScreen({ id: "playback", blob: screen.blob, mimeType: screen.mimeType, durationSec: screen.durationSec })}
      />
    </div>
  );

  if (screen.id === "detail") return (
    <div className="fixed inset-0 flex flex-col z-50">
      <DetailView clipId={screen.clipId} onBack={() => setScreen({ id: "library" })} />
    </div>
  );

  if (screen.id === "error") return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[#1E293B]">
        <Link href="/technique" className="text-[#8A98AC]"><ChevronLeft size={22} /></Link>
        <h1 className="text-base font-bold text-white">Video Review</h1>
      </div>
      <ErrorView reason={screen.reason} onRetry={() => setScreen({ id: "camera" })} />
    </div>
  );

  // Library (default)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[#1E293B]">
        <Link href="/technique" aria-label="Back to technique library" className="text-[#8A98AC] hover:text-white transition-colors">
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="text-base font-bold text-white">Video Review</h1>
          <p className="text-xs text-[#8A98AC]">Record and analyze your technique</p>
        </div>
      </div>
      <LibraryView
        onRecord={() => setScreen({ id: "camera" })}
        onDetail={(id) => setScreen({ id: "detail", clipId: id })}
      />
    </div>
  );
}
