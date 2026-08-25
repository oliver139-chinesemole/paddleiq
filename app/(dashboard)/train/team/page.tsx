"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/useUser";
import { toLocalDateStr } from "@/lib/utils";

export default function TeamSessionPage() {
  const router = useRouter();
  const { userId } = useUser();
  const [saved, setSaved] = useState(false);
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

  async function handleSave() {
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
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Duration (min)" type="number" placeholder="90" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
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
            onChange={(e) => setForm({ ...form, practiceType: e.target.value })}
          />
          <Input label="Distance (m, optional)" type="number" placeholder="8000" value={form.distanceM} onChange={(e) => setForm({ ...form, distanceM: e.target.value })} />
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
            onChange={(e) => setForm({ ...form, paddleSide: e.target.value })}
          />
          <Input label="Seat # (optional)" type="number" placeholder="3" value={form.seatNumber} onChange={(e) => setForm({ ...form, seatNumber: e.target.value })} />
          <Select
            label="Role in Boat"
            options={[
              { value: "paddler", label: "Paddler" },
              { value: "drummer", label: "Drummer" },
              { value: "steersperson", label: "Steersperson" },
              { value: "caller", label: "Stroke Caller" },
            ]}
            value={form.roleInBoat}
            onChange={(e) => setForm({ ...form, roleInBoat: e.target.value })}
          />
          <Input label="Stroke Rate (spm)" type="number" placeholder="72" value={form.strokeRate} onChange={(e) => setForm({ ...form, strokeRate: e.target.value })} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Effort Level (RPE)</h2>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n}
              onClick={() => setForm({ ...form, rpe: String(n) })}
              className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                form.rpe === String(n) ? "bg-[#F97316] text-white" : "bg-[#1E293B] text-[#8A98AC] hover:bg-[#334155]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <Textarea
          label="Session Notes"
          placeholder="Timing was off in race pieces but improved by end of practice. Coach focused on catch timing and rotation. Team was 85% synchronized by the last piece."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <Button onClick={handleSave} className="w-full bg-[#F97316] hover:bg-[#EA580C]" size="lg">
        Save Team Practice
      </Button>
    </div>
  );
}
