"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Activity, Plus, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toLocalDateStr } from "@/lib/utils";

const PADDLE_EXERCISES = [
  "Pull-ups", "Lat Pulldown", "Bent-over Rows", "Single-arm Rows",
  "Deadlift", "Romanian Deadlift", "Squat", "Front Squat",
  "Russian Twists", "Med Ball Slams", "Cable Rotations", "Pallof Press",
  "Plank", "Side Plank", "Ab Wheel", "Hollow Body Hold",
  "Push-ups", "Shoulder Press", "Face Pulls", "Band Pull-aparts",
  "Tricep Dips", "Bicep Curls", "Wrist Curls", "Forearm Strengthening",
];

interface Exercise {
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
}

export default function DrylandPage() {
  const router = useRouter();
  const { userId } = useUser();
  const [saved, setSaved] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: "Pull-ups", sets: "3", reps: "10", weight: "", rpe: "7" },
  ]);
  const [form, setForm] = useState({
    date: toLocalDateStr(new Date()),
    durationMin: "",
    rpe: "7",
    notes: "",
  });

  function addExercise(name?: string) {
    setExercises([...exercises, { name: name || "", sets: "3", reps: "10", weight: "", rpe: "7" }]);
  }

  function removeExercise(i: number) {
    setExercises(exercises.filter((_, idx) => idx !== i));
  }

  function updateExercise(i: number, field: keyof Exercise, value: string) {
    setExercises(exercises.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));
  }

  async function handleSave() {
    setSaved(true);
    try {
      const { saveDrylandSession } = await import("@/lib/db/sessions");
      await saveDrylandSession({
        userId,
        user_id: userId,
        date: form.date,
        duration_min: parseInt(form.durationMin) || 0,
        exercises: exercises.map((ex) => ({
          name: ex.name,
          sets: parseInt(ex.sets) || 0,
          reps: ex.reps ? parseInt(ex.reps) : undefined,
          weight_kg: ex.weight ? parseFloat(ex.weight) : undefined,
          rpe: ex.rpe ? parseInt(ex.rpe) : undefined,
        })),
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
        <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#10B981]" />
        </div>
        <h2 className="text-xl font-black text-[#F1F5F9]">Dryland Session Saved!</h2>
        <p className="text-[#64748B] text-sm">{exercises.length} exercise{exercises.length !== 1 ? "s" : ""} logged.</p>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
          <Activity size={20} className="text-[#10B981]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">Dryland Training</h1>
          <p className="text-xs text-[#64748B]">Gym, strength & conditioning</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Duration (min)" type="number" placeholder="45" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
        </div>
      </div>

      {/* Exercises */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Exercises</h2>
        {exercises.map((ex, i) => (
          <div key={i} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
            <div className="flex items-center justify-between mb-3">
              <select
                value={ex.name}
                onChange={(e) => updateExercise(i, "name", e.target.value)}
                className="flex-1 bg-transparent text-sm font-bold text-[#F1F5F9] outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0D1528]">Select exercise…</option>
                {PADDLE_EXERCISES.map((name) => (
                  <option key={name} value={name} className="bg-[#0D1528]">{name}</option>
                ))}
              </select>
              <button onClick={() => removeExercise(i)} className="text-[#475569] hover:text-[#EF4444] transition-colors ml-2">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#64748B]">Sets</label>
                <input
                  type="number" value={ex.sets} onChange={(e) => updateExercise(i, "sets", e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#1E293B] bg-[#111827] px-2 text-sm text-[#F1F5F9] outline-none text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#64748B]">Reps</label>
                <input
                  type="number" value={ex.reps} onChange={(e) => updateExercise(i, "reps", e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#1E293B] bg-[#111827] px-2 text-sm text-[#F1F5F9] outline-none text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#64748B]">kg</label>
                <input
                  type="number" value={ex.weight} onChange={(e) => updateExercise(i, "weight", e.target.value)}
                  placeholder="BW" className="h-9 w-full rounded-lg border border-[#1E293B] bg-[#111827] px-2 text-sm text-[#F1F5F9] outline-none text-center placeholder:text-[#475569]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#64748B]">RPE</label>
                <input
                  type="number" min="1" max="10" value={ex.rpe} onChange={(e) => updateExercise(i, "rpe", e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#1E293B] bg-[#111827] px-2 text-sm text-[#F1F5F9] outline-none text-center"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => addExercise()}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#334155] py-3 text-sm font-semibold text-[#64748B] hover:border-[#475569] hover:text-[#94A3B8] transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Exercise
        </button>
      </div>

      {/* Quick Add */}
      <div>
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Quick Add</h2>
        <div className="flex flex-wrap gap-2">
          {["Pull-ups", "Russian Twists", "Plank", "Lat Pulldown", "Med Ball Slams", "Rows"].map((name) => (
            <button
              key={name}
              onClick={() => addExercise(name)}
              className="text-xs font-medium bg-[#1E293B] text-[#64748B] hover:bg-[#334155] hover:text-[#94A3B8] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              + {name}
            </button>
          ))}
        </div>
      </div>

      {/* Overall RPE */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Overall Session RPE</h2>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n}
              onClick={() => setForm({ ...form, rpe: String(n) })}
              className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                form.rpe === String(n) ? "bg-[#10B981] text-white" : "bg-[#1E293B] text-[#64748B] hover:bg-[#334155]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
        <Textarea
          label="Notes"
          placeholder="Focused on lat activation and pull pattern. Pull-ups felt strong — 3 more than last week."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <Button onClick={handleSave} className="w-full bg-[#10B981] hover:bg-[#059669]" size="lg">
        Save Dryland Session
      </Button>
    </div>
  );
}
