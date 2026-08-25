"use client";

import { useState } from "react";
import { ChevronRight, Calendar, Target, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trainingPlans } from "@/lib/data/seed";
import { cn } from "@/lib/utils";
import { useActivePlan, writeActivePlan, writePlanStart } from "@/lib/plans/active";
import { phaseForWeek, isDeloadWeek, weekInPhase } from "@/lib/plans/generate";
import { PLAN_SPECS } from "@/lib/plans/specs";
import { toLocalDateStr } from "@/lib/utils";

const difficultyColor = {
  beginner: "success" as const,
  intermediate: "warning" as const,
  advanced: "destructive" as const,
};

export default function PlansPage() {
  // Persisted, not component-local: "Start This Plan" used to vanish on
  // refresh and the dashboard had no way to see it.
  const activePlan = useActivePlan();

  function toggleActivePlan(planId: string) {
    const next = activePlan === planId ? null : planId;
    writeActivePlan(next);
    // The start date is what lets the dashboard work out which week you're in.
    writePlanStart(next ? toLocalDateStr(new Date()) : null);
  }
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [viewWeek, setViewWeek] = useState(1);

  const plan = selectedPlan ? trainingPlans.find((p) => p.id === selectedPlan) : null;

  if (plan) {
    const week = plan.weekly_schedule.find((w) => w.week === viewWeek) ?? plan.weekly_schedule[0];
    const planSpec = PLAN_SPECS.find((sp) => sp.id === plan.id)!;
    const phase = phaseForWeek(planSpec, week?.week ?? 1);
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <button onClick={() => setSelectedPlan(null)} className="text-sm text-[#0EA5E9] hover:underline text-left">
          ← Training Plans
        </button>

        <div>
          <Badge variant={difficultyColor[plan.difficulty]} className="mb-2">
            {plan.difficulty}
          </Badge>
          <h1 className="text-2xl font-black text-[#F1F5F9]">{plan.name}</h1>
          <p className="text-sm text-[#8A98AC] mt-2 leading-relaxed">{plan.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-3 text-center">
            <div className="text-xl font-black text-[#0EA5E9]">{plan.duration_weeks}</div>
            <div className="text-[10px] text-[#8A98AC] mt-0.5">weeks</div>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#0D1528] p-3 text-center">
            <div className="text-xl font-black text-[#F1F5F9]">{plan.focus.length}</div>
            <div className="text-[10px] text-[#8A98AC] mt-0.5">focus areas</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {plan.focus.map((f) => (
            <span key={f} className="text-xs bg-[#1E293B] text-[#94A3B8] px-3 py-1 rounded-full">
              {f}
            </span>
          ))}
        </div>

        {week && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-bold text-[#F1F5F9]">
                Week {week.week} of {plan.duration_weeks}
              </h2>
              {phase && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0EA5E9]">
                  {phase.name}{isDeloadWeek(weekInPhase(planSpec, week.week), phase) ? " · recovery week" : ""}
                </span>
              )}
            </div>

            {/* Every week is browsable — the schedule used to stop at week 1. */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2 mb-3">
              {plan.weekly_schedule.map((w) => (
                <button
                  key={w.week}
                  onClick={() => setViewWeek(w.week)}
                  aria-label={`Week ${w.week}`}
                  aria-pressed={w.week === week.week}
                  className={cn(
                    "shrink-0 w-9 h-9 rounded-lg text-xs font-bold transition-colors",
                    w.week === week.week
                      ? "bg-[#0EA5E9] text-[#0A0F1E]"
                      : "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]"
                  )}
                >
                  {w.week}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {week.days.map((day) => {
                const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                const typeColor = {
                  erg: "#0EA5E9", water: "#06B6D4", team: "#F97316",
                  dryland: "#10B981", rest: "#7C8AA0", recovery: "#8A98AC",
                };
                return (
                  <div key={day.day} className={cn(
                    "flex items-center gap-4 rounded-xl border p-3",
                    day.type === "rest" || day.type === "recovery"
                      ? "border-[#1E293B] opacity-60"
                      : "border-[#1E293B] bg-[#0D1528]"
                  )}>
                    <div className="w-10 text-center shrink-0">
                      <div className="text-[10px] text-[#7C8AA0]">{dayNames[day.day - 1]}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeColor[day.type as keyof typeof typeColor] || "#7C8AA0" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#F1F5F9]">{day.name}</div>
                      <div className="text-xs text-[#8A98AC]">{day.description}</div>
                    </div>
                    <div className="text-xs text-[#7C8AA0] shrink-0">{day.duration_min > 0 ? `${day.duration_min}m` : "Rest"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          onClick={() => {
            toggleActivePlan(plan.id);
            setSelectedPlan(null);
          }}
          variant={activePlan === plan.id ? "secondary" : "default"}
          className="w-full"
        >
          {activePlan === plan.id ? "Deactivate Plan" : "Start This Plan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#F1F5F9]">Training Plans</h1>
        <p className="text-sm text-[#8A98AC] mt-1">Structured plans for every goal.</p>
      </div>

      {/* Active Plan Banner */}
      {activePlan && (
        <div className="rounded-2xl bg-gradient-to-r from-[#0284C7] to-[#0D9488] p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} className="text-white" />
            <span className="text-xs font-semibold text-[#BAE6FD] uppercase tracking-wider">Active Plan</span>
          </div>
          <h2 className="text-base font-black text-white">
            {trainingPlans.find((p) => p.id === activePlan)?.name}
          </h2>
          <Progress value={15} color="rgba(255,255,255,0.8)" className="mt-3 bg-white/20" />
          <p className="text-xs text-[#BAE6FD] mt-1">Week 1 of {trainingPlans.find((p) => p.id === activePlan)?.duration_weeks} · 15% complete</p>
        </div>
      )}

      {/* Plans Grid */}
      <div className="flex flex-col gap-4">
        {trainingPlans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={cn(
              "rounded-2xl border p-5 text-left transition-all cursor-pointer w-full hover:border-[#334155]",
              activePlan === plan.id ? "border-[#0EA5E9] bg-[#0EA5E9]/10" : "border-[#1E293B] bg-[#0D1528]"
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={difficultyColor[plan.difficulty]} className="text-[10px]">
                  {plan.difficulty}
                </Badge>
                {activePlan === plan.id && (
                  <Badge variant="default" className="text-[10px]">Active</Badge>
                )}
              </div>
              <ChevronRight size={16} className="text-[#7C8AA0] shrink-0" />
            </div>
            <h3 className="text-base font-bold text-[#F1F5F9] mb-1">{plan.name}</h3>
            <p className="text-xs text-[#8A98AC] leading-relaxed mb-3 line-clamp-2">{plan.description}</p>
            <div className="flex items-center gap-4 text-xs text-[#7C8AA0]">
              <span className="flex items-center gap-1"><Calendar size={11} /> {plan.duration_weeks} weeks</span>
              <span className="flex items-center gap-1"><Target size={11} /> {plan.focus.slice(0, 2).join(", ")}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Custom plan CTA */}
      <div className="rounded-xl border border-dashed border-[#334155] p-5 text-center">
        <div className="text-sm font-semibold text-[#8A98AC] mb-1">Want a custom plan?</div>
        <div className="text-xs text-[#7C8AA0]">The AI Coach can generate a personalized plan based on your goals and schedule.</div>
        <button className="text-xs text-[#0EA5E9] mt-2 hover:underline font-semibold">Ask AI Coach →</button>
      </div>
    </div>
  );
}
