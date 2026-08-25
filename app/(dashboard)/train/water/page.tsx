"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { CheckCircle, Droplets, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, formatPace, calcPacePer500m, toLocalDateStr } from "@/lib/utils";
import { validateWaterForm, isValid, type FieldErrors } from "@/lib/validation/session";

const DISTANCES = [
  { value: "200", label: "200m" },
  { value: "250", label: "250m" },
  { value: "500", label: "500m" },
  { value: "1000", label: "1000m" },
  { value: "2000", label: "2000m" },
  { value: "custom", label: "Custom" },
];

export default function WaterSessionPage() {
  const router = useRouter();
  const { userId } = useUser();
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    date: toLocalDateStr(new Date()),
    distancePreset: "500",
    customDistance: "",
    minutes: "",
    seconds: "",
    boatType: "OC-1",
    paddleType: "",
    waterCondition: "flat",
    windSpeed: "",
    strokeRate: "",
    heartRate: "",
    rpe: "7",
    notes: "",
  });

  const distM = form.distancePreset === "custom"
    ? parseInt(form.customDistance || "0")
    : parseInt(form.distancePreset);
  const durationSec = parseInt(form.minutes || "0") * 60 + parseInt(form.seconds || "0");
  const split = calcPacePer500m(distM, durationSec);

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev: FieldErrors) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  async function handleSave() {
    // Previously unguarded: an empty form saved a zeroed session and navigated
    // away as though it had worked.
    const found = validateWaterForm({ date: form.date, distanceM: String(distM || ""), minutes: form.minutes, seconds: form.seconds, strokeRate: form.strokeRate, heartRate: form.heartRate, rpe: form.rpe });
    setErrors(found);
    if (!isValid(found)) return;

    setSaved(true);
    try {
      const { saveWaterSession } = await import("@/lib/db/sessions");
      await saveWaterSession({
        userId,
        user_id: userId,
        date: form.date,
        distance_m: distM,
        duration_sec: durationSec,
        avg_pace_sec: split,
        avg_speed_kmh: distM > 0 && durationSec > 0 ? (distM / 1000) / (durationSec / 3600) : 0,
        max_speed_kmh: 0,
        stroke_rate: form.strokeRate ? parseInt(form.strokeRate) : undefined,
        rpe: parseInt(form.rpe),
        boat_type: form.boatType,
        water_condition: form.waterCondition as "flat" | "slight_chop" | "choppy" | "windy" | "current",
        wind_speed: form.windSpeed ? parseInt(form.windSpeed) : undefined,
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
        <div className="w-16 h-16 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#06B6D4]" />
        </div>
        <h2 className="text-xl font-black text-[#F1F5F9]">Time Trial Saved!</h2>
        {split > 0 && (
          <div className="text-center">
            <div className="text-3xl font-black text-[#06B6D4]">{formatPace(split)}</div>
            <div className="text-sm text-[#8A98AC] mt-1">Your pace</div>
          </div>
        )}
        <p className="text-[#8A98AC] text-sm">Redirecting to dashboard…</p>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
          <Droplets size={20} className="text-[#06B6D4]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">Solo Water Time Trial</h1>
          <p className="text-xs text-[#8A98AC]">OC / kayak / canoe / solo paddle craft</p>
        </div>
      </div>

      {/* Distance Selection */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Race Distance</h2>
        <div className="grid grid-cols-3 gap-2">
          {DISTANCES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setForm({ ...form, distancePreset: value })}
              className={`rounded-xl border p-3 text-sm font-bold transition-colors cursor-pointer ${
                form.distancePreset === value
                  ? "border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]"
                  : "border-[#1E293B] bg-[#111827] text-[#8A98AC] hover:border-[#334155]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {form.distancePreset === "custom" && (
          <div className="mt-3">
            <Input
              label="Custom Distance (m)"
              type="number"
              placeholder="750"
              value={form.customDistance}
              onChange={(e) => updateField("customDistance", e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Time & Split */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Time Result</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Input label="Date" type="date"
            error={errors.date} value={form.date} onChange={(e) => updateField("date", e.target.value)} />
          <div />
        </div>
        <label className="text-sm font-medium text-[#94A3B8]">Finish Time</label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <Input type="number" placeholder="Minutes"
            error={errors.minutes} value={form.minutes} onChange={(e) => updateField("minutes", e.target.value)} />
          <Input type="number" placeholder="Seconds"
            error={errors.seconds} value={form.seconds} onChange={(e) => updateField("seconds", e.target.value)} />
        </div>

        {split > 0 && (
          <div className="mt-4 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#06B6D4] font-semibold mb-1">Pace</div>
                <div className="text-2xl font-black text-[#06B6D4]">{formatPace(split)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#8A98AC] mb-1">Total Time</div>
                <div className="text-xl font-bold text-[#F1F5F9]">{formatTime(durationSec)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Boat & Conditions */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Boat & Conditions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Boat Type"
            options={[
              { value: "OC-1", label: "OC-1" },
              { value: "kayak", label: "Kayak" },
              { value: "canoe", label: "Canoe" },
              { value: "single_db", label: "Single Dragon Boat" },
              { value: "surfski", label: "Surfski" },
              { value: "other", label: "Other" },
            ]}
            value={form.boatType}
            onChange={(e) => updateField("boatType", e.target.value)}
          />
          <Select
            label="Water Condition"
            options={[
              { value: "flat", label: "Flat / Calm" },
              { value: "slight_chop", label: "Slight Chop" },
              { value: "choppy", label: "Choppy" },
              { value: "windy", label: "Windy" },
              { value: "current", label: "Current" },
            ]}
            value={form.waterCondition}
            onChange={(e) => updateField("waterCondition", e.target.value)}
          />
          <Input
            label="Stroke Rate (spm)"
            type="number"
            placeholder="78"
            value={form.strokeRate}
            onChange={(e) => updateField("strokeRate", e.target.value)}
          />
          <Input
            label="Wind Speed (km/h)"
            type="number"
            placeholder="10"
            value={form.windSpeed}
            onChange={(e) => updateField("windSpeed", e.target.value)}
          />
        </div>
      </div>

      {/* RPE */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Effort Level (RPE)</h2>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n}
              onClick={() => setForm({ ...form, rpe: String(n) })}
              className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                form.rpe === String(n)
                  ? "bg-[#06B6D4] text-white"
                  : "bg-[#1E293B] text-[#8A98AC] hover:bg-[#334155]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* GPS / Location placeholder */}
      <div className="rounded-2xl border border-dashed border-[#334155] p-5 flex items-center gap-3">
        <MapPin size={20} className="text-[#8A98AC]" />
        <div>
          <div className="text-sm font-semibold text-[#8A98AC]">GPS Route Tracking</div>
          <div className="text-xs text-[#7C8AA0]">Live GPS recording — coming in next update</div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <Textarea
          label="Notes (start, conditions, technique, fatigue)"
          placeholder="Caught a headwind on the return leg. Catch felt solid. Start was explosive — best in months."
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      </div>

      <Button onClick={handleSave} variant="default" className="w-full bg-[#06B6D4] hover:bg-[#0891B2]" size="lg">
        Save Time Trial
      </Button>
    </div>
  );
}
