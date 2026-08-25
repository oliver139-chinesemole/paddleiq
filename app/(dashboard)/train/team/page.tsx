"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EffortPicker } from "@/components/ui/effort-picker";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/useUser";
import { toLocalDateStr } from "@/lib/utils";
import { validateTeamForm, isValid, type FieldErrors } from "@/lib/validation/session";

export default function TeamSessionPage() {
  const router = useRouter();
  const { userId } = useUser();
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    date: toLocalDateStr(new Date()),
    durationMin: "",
    practiceType: "endurance",
    seatNumber: "",
    paddleSide: "left",
    roleInBoat: "paddler",
    strokeRate: "",
    distanceM: "",
    rpe: "6",
    notes: "",
  });

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev: FieldErrors) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  async function handleSave() {
    // Previously unguarded: an empty form saved a zeroed session and navigated
    // away as though it had worked.
    const found = validateTeamForm({ date: form.date, durationMin: form.durationMin, distanceM: form.distanceM, strokeRate: form.strokeRate, rpe: form.rpe });
    setErrors(found);
    if (!isValid(found)) return;

    setSaved(true);
    try {
      const { saveTeamSession } = await import("@/lib/db/sessions");
      await saveTeamSession({
        userId,
        user_id: userId,
        team_id: "",
        date: form.date,
        duration_min: parseInt(form.durationMin) || 0,
        distance_m: form.distanceM ? parseInt(form.distanceM) : undefined,
        practice_type: form.practiceType as "endurance" | "starts" | "race_pieces" | "technique" | "intervals" | "mixed",
        seat_position: form.seatNumber ? parseInt(form.seatNumber) : undefined,
        paddle_side: form.paddleSide as "left" | "right",
        role_in_boat: form.roleInBoat as "paddler" | "drummer" | "steersperson" | "caller",
        stroke_rate: form.strokeRate ? parseInt(form.strokeRate) : undefined,
        rpe: parseInt(form.rpe),
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
        <div className="w-16 h-16 rounded-full bg-[#F97316]/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#F97316]" />
        </div>
        <h2 className="text-xl font-black text-[#F1F5F9]">Practice Logged!</h2>
        <p className="text-[#8A98AC] text-sm">Great session with your team.</p>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F97316]/20 flex items-center justify-center">
          <Users size={20} className="text-[#F97316]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">Dragon Boat Practice</h1>
          <p className="text-xs text-[#8A98AC]">Team session on the water</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Practice Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date"
            error={errors.date} value={form.date} onChange={(e) => updateField("date", e.target.value)} />
          <Input label="Duration (min)" type="number" placeholder="90" value={form.durationMin} onChange={(e) => updateField("durationMin", e.target.value)} error={errors.durationMin} />
          <Select
            label="Practice Type"
            options={[
              { value: "endurance", label: "Endurance" },
              { value: "starts", label: "Race Starts" },
              { value: "race_pieces", label: "Race Pieces" },
              { value: "technique", label: "Technique" },
              { value: "intervals", label: "Intervals" },
              { value: "mixed", label: "Mixed" },
            ]}
            value={form.practiceType}
            onChange={(e) => updateField("practiceType", e.target.value)}
          />
          <Input label="Distance (m, optional)" type="number" placeholder="8000" value={form.distanceM} onChange={(e) => updateField("distanceM", e.target.value)} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-4">Your Position</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Paddle Side"
            options={[
              { value: "left", label: "Left Side" },
              { value: "right", label: "Right Side" },
            ]}
            value={form.paddleSide}
            onChange={(e) => updateField("paddleSide", e.target.value)}
          />
          <Input label="Seat # (optional)" type="number" placeholder="3" value={form.seatNumber} onChange={(e) => updateField("seatNumber", e.target.value)} />
          <Select
            label="Role in Boat"
            options={[
              { value: "paddler", label: "Paddler" },
              { value: "drummer", label: "Drummer" },
              { value: "steersperson", label: "Steersperson" },
              { value: "caller", label: "Stroke Caller" },
            ]}
            value={form.roleInBoat}
            onChange={(e) => updateField("roleInBoat", e.target.value)}
          />
          <Input label="Stroke Rate (spm)" type="number" placeholder="72" value={form.strokeRate} onChange={(e) => updateField("strokeRate", e.target.value)} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Effort Level (RPE)</h2>
        <EffortPicker
            label="Effort"
            value={form.rpe}
            onChange={(v) => updateField("rpe", v)}
            error={errors.rpe}
          />
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <Textarea
          label="Session Notes"
          placeholder="Timing was off in race pieces but improved by end of practice. Coach focused on catch timing and rotation. Team was 85% synchronized by the last piece."
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      </div>

      <Button onClick={handleSave} className="w-full bg-[#F97316] hover:bg-[#EA580C]" size="lg">
        Save Team Practice
      </Button>
    </div>
  );
}
