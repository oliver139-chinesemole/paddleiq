"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Dumbbell, TrendingUp } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useWakeLock } from "@/hooks/useWakeLock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatTime, formatPace } from "@/lib/utils";

type WorkoutType = "steady" | "intervals" | "test" | "pyramid";

const INTERVALS = [
  { label: "10 × 1 min hard / 1 min easy", sets: 10, workSec: 60, restSec: 60 },
  { label: "5 × 500m", sets: 5, workSec: 0, restSec: 180 },
  { label: "4 × 250m all-out", sets: 4, workSec: 0, restSec: 240 },
  { label: "500m test", sets: 1, workSec: 0, restSec: 0 },
  { label: "2k test", sets: 1, workSec: 0, restSec: 0 },
  { label: "Custom", sets: 0, workSec: 0, restSec: 0 },
];

export default function ErgSessionPage() {
  const router = useRouter();
  const { userId } = useUser();
  const { acquire: wakeLockAcquire, release: wakeLockRelease } = useWakeLock();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    workoutType: "steady" as WorkoutType,
    distanceM: "",
    minutes: "",
    seconds: "",
    strokeRate: "",
    watts: "",
    heartRate: "",
    rpe: "7",
    resistance: "4",
    paddleSide: "left",
    intervalTemplate: "",
    notes: "",
  });

  const durationSec = parseInt(form.minutes || "0") * 60 + parseInt(form.seconds || "0");
  const distM = parseInt(form.distanceM || "0");
  const splitSec = distM > 0 && durationSec > 0 ? (durationSec / distM) * 500 : 0;

  async function handleSave() {
    setSaved(true);
    wakeLockRelease();
    try {
      const { saveErgSession } = await import("@/lib/db/sessions");
      await saveErgSession({
        userId,
        date: form.date,
        distance_m: parseInt(form.distanceM) || 0,
        duration_sec: durationSec,
        split_sec: splitSec,
        stroke_rate: parseInt(form.strokeRate) || 0,
        watts: form.watts ? parseInt(form.watts) : undefined,
        heart_rate: form.heartRate ? parseInt(form.heartRate) : undefined,
        rpe: parseInt(form.rpe),
        resistance: parseInt(form.resistance),
        paddle_side: form.paddleSide as "left" | "right" | "both",
        workout_type: form.workoutType,
        notes: form.notes,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Local save failed:", err);
    }
    setTimeout(() => router.push("/dashboard"), 1800);
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#10B981]" />
        </div>
        <h2 className="text-xl font-black text-[#F1F5F9]">Session Saved!</h2>
        {splitSec > 0 && (
          <div className="text-center">
            <div className="text-3xl font-black gradient-text">{formatPace(splitSec)}</div>
            <div className="text-sm text-[#64748B] mt-1">Your split</div>
          </div>
        )}
        <p className="text-[#64748B] text-sm">Redirecting to dashboard…</p>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0EA5E9]/20 flex items-center justify-center">
          <Dumbbell size={20} className="text-[#0EA5E9]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">Log Erg Session</h1>
          <p className="text-xs text-[#64748B]">Paddle erg / P-Erg training</p>
        </div>
      </div>

      {/* Workout Type */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Workout Type</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["steady", "intervals", "test", "pyramid"] as WorkoutType[]).map((type) => (
            <button
              key={type}
              onClick={() => setForm({ ...form, workoutType: type })}
              className={`rounded-xl border p-3 text-sm font-semibold transition-colors cursor-pointer ${
                form.workoutType === type
                  ? "border-[#0EA5E9] bg-[#0EA5E9]/15 text-[#0EA5E9]"
                  : "border-[#1E293B] bg-[#111827] text-[#64748B] hover:border-[#334155]"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {form.workoutType === "intervals" && (
          <div className="mt-3">
            <Select
              label="Interval Template"
              options={INTERVALS.map((i) => ({ value: i.label, label: i.label }))}
              value={form.intervalTemplate}
              onChange={(e) => setForm({ ...form, intervalTemplate: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Core Stats */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">Session Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Distance (m)"
            type="number"
            placeholder="2000"
            value={form.distanceM}
            onChange={(e) => setForm({ ...form, distanceM: e.target.value })}
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className="mt-3">
          <label className="text-sm font-medium text-[#94A3B8]">Duration</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            <Input
              type="number"
              placeholder="Minutes"
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Seconds"
              value={form.seconds}
              onChange={(e) => setForm({ ...form, seconds: e.target.value })}
            />
          </div>
        </div>

        {/* Live Split Preview */}
        {splitSec > 0 && (
          <div className="mt-4 rounded-xl bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-[#0EA5E9]" />
              <span className="text-xs text-[#0EA5E9] font-semibold">Calculated Split</span>
            </div>
            <div className="text-2xl font-black gradient-text">{formatPace(splitSec)}</div>
            <div className="text-xs text-[#64748B] mt-1">Total: {formatTime(durationSec)}</div>
          </div>
        )}
      </div>

      {/* Performance Details */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">Performance Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Stroke Rate (spm)"
            type="number"
            placeholder="72"
            value={form.strokeRate}
            onChange={(e) => setForm({ ...form, strokeRate: e.target.value })}
          />
          <Input
            label="Watts (optional)"
            type="number"
            placeholder="210"
            value={form.watts}
            onChange={(e) => setForm({ ...form, watts: e.target.value })}
          />
          <Input
            label="Heart Rate (bpm)"
            type="number"
            placeholder="165"
            value={form.heartRate}
            onChange={(e) => setForm({ ...form, heartRate: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#94A3B8]">RPE (1–10)</label>
            <div className="flex gap-1 flex-wrap mt-1">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button
                  key={n}
                  onClick={() => setForm({ ...form, rpe: String(n) })}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    form.rpe === String(n)
                      ? "bg-[#0EA5E9] text-white"
                      : "bg-[#1E293B] text-[#64748B] hover:bg-[#334155]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">Session Settings</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Paddle Side"
            options={[
              { value: "left", label: "Left Side" },
              { value: "right", label: "Right Side" },
              { value: "both", label: "Alternating" },
            ]}
            value={form.paddleSide}
            onChange={(e) => setForm({ ...form, paddleSide: e.target.value })}
          />
          <Select
            label="Resistance"
            options={Array.from({ length: 10 }, (_, i) => ({
              value: String(i + 1),
              label: `Level ${i + 1}`,
            }))}
            value={form.resistance}
            onChange={(e) => setForm({ ...form, resistance: e.target.value })}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <Textarea
          label="Notes (technique, feel, focus)"
          placeholder="Catch felt clean today. Exit timing improved. Faded slightly in last 500m of the 2k..."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="min-h-[80px]"
        />
      </div>

      {/* Save */}
      <Button onClick={handleSave} className="w-full" size="lg">
        Save Erg Session
      </Button>
    </div>
  );
}
