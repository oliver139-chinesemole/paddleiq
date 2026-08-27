"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Dumbbell, TrendingUp } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useWakeLock } from "@/hooks/useWakeLock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EffortPicker } from "@/components/ui/effort-picker";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, formatPace, toLocalDateStr, parseSplit } from "@/lib/utils";
import { validateErgForm, isValid, type FieldErrors } from "@/lib/validation/session";

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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    date: toLocalDateStr(new Date()),
    workoutType: "steady" as WorkoutType,
    distanceM: "",
    minutes: "",
    seconds: "",
    strokeRate: "",
    watts: "",
    heartRate: "",
    // Must be a value the five-level picker can actually produce (2/4/6/8/10).
    // This was 7, left over from the old 1-10 slider: the picker rounds up, so
    // an untouched form highlighted "Very hard" and then saved 7 — a value no
    // selection maps to, and a harder default than anyone means to log.
    rpe: "6",
    resistance: "4",
    paddleSide: "left",
    intervalTemplate: "",
    notes: "",
  });

  // Seconds per 500m for each 500m, as typed. Kept as strings so a
  // half-filled row doesn't become a 0 and read as an impossibly fast split.
  const [splits, setSplits] = useState<string[]>([]);

  // A piece is worth splitting only when it divides into whole 500s and is
  // long enough for a fade to mean anything. Intervals are excluded: their
  // total time includes the rests, so per-500 figures wouldn't line up.
  const distanceM = parseInt(form.distanceM) || 0;
  const segmentCount =
    form.workoutType === "intervals" || form.workoutType === "pyramid"
      ? 0
      : distanceM >= 1000 && distanceM % 500 === 0 && distanceM <= 5000
        ? distanceM / 500
        : 0;
  const parsedSplits = splits
    .slice(0, segmentCount)
    .map((v) => parseSplit(v))
    .filter((v): v is number => v !== null);

  // The screen must stay awake while an athlete is on the erg with the form
  // open. release() was already called on save, but nothing ever acquired the
  // lock, so it did nothing at all.
  useEffect(() => {
    void wakeLockAcquire();
    return () => { void wakeLockRelease(); };
  }, [wakeLockAcquire, wakeLockRelease]);

  const durationSec = parseInt(form.minutes || "0") * 60 + parseInt(form.seconds || "0");
  const distM = parseInt(form.distanceM || "0");
  const splitSec = distM > 0 && durationSec > 0 ? (durationSec / distM) * 500 : 0;

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear this field's error the moment it's touched, rather than leaving a
    // stale complaint under a field the athlete has just fixed.
    setErrors((prev: FieldErrors) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  async function handleSave() {
    // Previously unguarded: an empty form saved a 0m/0s session and navigated
    // to the dashboard as though it had worked.
    const found = validateErgForm(form);
    setErrors(found);
    if (!isValid(found)) return;

    setSaved(true);
    wakeLockRelease();
    try {
      const { saveErgSession } = await import("@/lib/db/sessions");
      await saveErgSession({
        userId,
        user_id: userId,
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
        // Only sent when every segment was filled in. A partial set would
        // make the coach compare a real split against a missing one.
        segment_splits: parsedSplits.length === segmentCount && segmentCount > 0
          ? parsedSplits
          : undefined,
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
            <div className="text-sm text-[#8A98AC] mt-1">Your split</div>
          </div>
        )}
        <p className="text-[#8A98AC] text-sm">Redirecting to dashboard…</p>
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
          <p className="text-xs text-[#8A98AC]">Paddle erg / P-Erg training</p>
        </div>
      </div>

      {/* Workout Type */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Workout Type</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["steady", "intervals", "test", "pyramid"] as WorkoutType[]).map((type) => (
            <button
              key={type}
              onClick={() => setForm({ ...form, workoutType: type })}
              className={`rounded-xl border p-3 text-sm font-semibold transition-colors cursor-pointer ${
                form.workoutType === type
                  ? "border-[#0EA5E9] bg-[#0EA5E9]/15 text-[#0EA5E9]"
                  : "border-[#1E293B] bg-[#111827] text-[#8A98AC] hover:border-[#334155]"
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
              onChange={(e) => updateField("intervalTemplate", e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Core Stats */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Session Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Distance (m)"
            type="number"
            placeholder="2000"
            error={errors.distanceM}
            value={form.distanceM}
            onChange={(e) => updateField("distanceM", e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            error={errors.date}
            value={form.date}
            onChange={(e) => updateField("date", e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label className="text-sm font-medium text-[#94A3B8]">Duration</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            <Input
              type="number"
              placeholder="Minutes"
            error={errors.minutes}
              value={form.minutes}
              onChange={(e) => updateField("minutes", e.target.value)}
            />
            <Input
              type="number"
              placeholder="Seconds"
            error={errors.seconds}
              value={form.seconds}
              onChange={(e) => updateField("seconds", e.target.value)}
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
            <div className="text-xs text-[#8A98AC] mt-1">Total: {formatTime(durationSec)}</div>
          </div>
        )}
      </div>

      {/* Per-500m splits — optional, and only for a continuous piece that
          divides into whole 500s. The coach's fade analysis needs these; it
          used to invent them and tell every athlete the same thing. */}
      {segmentCount > 0 && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
          <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-1">
            500m Splits (optional)
          </h2>
          <p className="text-xs text-[#8A98AC] leading-relaxed mb-4">
            Copy them off the monitor and the coach can tell you where you fade.
            Leave blank if you didn&apos;t record them.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: segmentCount }, (_, i) => (
              <Input
                key={i}
                label={`${i * 500}–${(i + 1) * 500}m`}
                type="text"
                inputMode="numeric"
                placeholder="1:58"
                value={splits[i] ?? ""}
                onChange={(e) => {
                  const next = [...splits];
                  next[i] = e.target.value;
                  setSplits(next);
                }}
              />
            ))}
          </div>
          {parsedSplits.length > 0 && parsedSplits.length < segmentCount && (
            <p className="text-[11px] text-[#7C8AA0] mt-3">
              Fill in all {segmentCount} to include them — a partial set would
              compare a real split against a missing one.
            </p>
          )}
        </div>
      )}

      {/* Performance Details */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Performance Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Stroke Rate (spm)"
            type="number"
            placeholder="72"
            error={errors.strokeRate}
            value={form.strokeRate}
            onChange={(e) => updateField("strokeRate", e.target.value)}
          />
          <Input
            label="Watts (optional)"
            type="number"
            placeholder="210"
            error={errors.watts}
            value={form.watts}
            onChange={(e) => updateField("watts", e.target.value)}
          />
          <Input
            label="Heart Rate (bpm)"
            type="number"
            placeholder="165"
            error={errors.heartRate}
            value={form.heartRate}
            onChange={(e) => updateField("heartRate", e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <EffortPicker
            label="Effort"
            value={form.rpe}
            onChange={(v) => updateField("rpe", v)}
            error={errors.rpe}
          />
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Session Settings</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Paddle Side"
            options={[
              { value: "left", label: "Left Side" },
              { value: "right", label: "Right Side" },
              { value: "both", label: "Alternating" },
            ]}
            value={form.paddleSide}
            onChange={(e) => updateField("paddleSide", e.target.value)}
          />
          <Select
            label="Resistance"
            options={Array.from({ length: 10 }, (_, i) => ({
              value: String(i + 1),
              label: `Level ${i + 1}`,
            }))}
            value={form.resistance}
            onChange={(e) => updateField("resistance", e.target.value)}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <Textarea
          label="Notes (technique, feel, focus)"
          placeholder="Catch felt clean today. Exit timing improved. Faded slightly in last 500m of the 2k..."
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
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
