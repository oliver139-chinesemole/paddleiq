"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "role",
    title: "What's your role?",
    subtitle: "We'll personalize your experience based on how you train.",
    options: [
      { value: "paddler", label: "Paddler", desc: "I paddle with a team or solo" },
      { value: "coach", label: "Coach", desc: "I coach a dragon boat team" },
      { value: "captain", label: "Team Captain", desc: "I lead a team and paddle" },
      { value: "beginner", label: "Beginner", desc: "I'm new to dragon boating" },
      { value: "competitive", label: "Competitive Racer", desc: "I train seriously for races" },
    ],
  },
  {
    id: "env",
    title: "Where do you train?",
    subtitle: "Select all that apply to you.",
    multi: true,
    options: [
      { value: "team_boat", label: "Dragon Boat", desc: "Team practices on the water" },
      { value: "erg", label: "Paddle Erg", desc: "P-erg or paddle erg at home/gym" },
      { value: "solo_water", label: "Solo Water", desc: "OC, kayak, canoe, or solo boat" },
      { value: "dryland", label: "Dryland / Gym", desc: "Strength and conditioning" },
    ],
  },
  {
    id: "goals",
    title: "What are your goals?",
    subtitle: "Pick your top priorities.",
    multi: true,
    options: [
      { value: "endurance", label: "Build Endurance", desc: "Paddle longer and recover faster" },
      { value: "technique", label: "Improve Technique", desc: "Better catch, rotation, timing" },
      { value: "erg_score", label: "Better Erg Score", desc: "Improve 500m/1k/2k split times" },
      { value: "race", label: "Race Readiness", desc: "Peak for an upcoming race" },
      { value: "team", label: "Make the Team", desc: "Earn a seat at tryouts" },
      { value: "fitness", label: "General Fitness", desc: "Use dragon boating to get fit" },
    ],
  },
  {
    id: "distance",
    title: "Preferred race distances?",
    subtitle: "We'll build your plans around these.",
    multi: true,
    options: [
      { value: "200", label: "200m", desc: "Sprint race" },
      { value: "250", label: "250m", desc: "Short sprint" },
      { value: "500", label: "500m", desc: "Standard race distance" },
      { value: "1000", label: "1km", desc: "Extended race" },
      { value: "2000", label: "2km", desc: "Long distance" },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const current = steps[step];

  function toggle(value: string) {
    if (current.multi) {
      const arr = (answers[current.id] as string[]) || [];
      setAnswers({
        ...answers,
        [current.id]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      });
    } else {
      setAnswers({ ...answers, [current.id]: value });
    }
  }

  function isSelected(value: string) {
    const ans = answers[current.id];
    if (Array.isArray(ans)) return ans.includes(value);
    return ans === value;
  }

  function canAdvance() {
    const ans = answers[current.id];
    if (!ans) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    return true;
  }

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      router.push("/dashboard");
    }
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-[#1E293B]">
        <div
          className="h-full bg-[#0EA5E9] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-lg mx-auto w-full">
        {/* Step indicator */}
        <p className="text-xs text-[#475569] font-medium mb-6">
          Step {step + 1} of {steps.length}
        </p>

        <h2 className="text-2xl font-black text-[#F1F5F9] mb-2">{current.title}</h2>
        <p className="text-[#64748B] text-sm mb-8">{current.subtitle}</p>

        <div className="flex flex-col gap-3">
          {current.options.map((opt) => {
            const selected = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
                  selected
                    ? "border-[#0EA5E9] bg-[#0EA5E9]/10"
                    : "border-[#1E293B] bg-[#0D1528] hover:border-[#334155]"
                )}
              >
                <div>
                  <div className={cn("font-semibold text-sm", selected ? "text-[#0EA5E9]" : "text-[#F1F5F9]")}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-[#64748B] mt-0.5">{opt.desc}</div>
                </div>
                {selected && (
                  <div className="h-6 w-6 rounded-full bg-[#0EA5E9] flex items-center justify-center shrink-0 ml-3">
                    <Check size={13} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="text-sm text-[#64748B] hover:text-[#94A3B8] transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <Button onClick={next} disabled={!canAdvance()}>
            {step === steps.length - 1 ? "Go to Dashboard" : "Continue"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
