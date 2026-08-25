import Link from "next/link";
import { Dumbbell, Droplets, Users, Activity, ChevronRight, Timer, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const modes = [
  {
    href: "/train/erg",
    icon: Dumbbell,
    title: "Paddle Erg",
    desc: "Log erg sessions — split, stroke rate, watts, RPE. Track 500m/1k/2k PRs.",
    color: "#0EA5E9",
    badge: "Most Popular",
    badgeVariant: "default" as const,
    features: ["Split tracking", "Interval workouts", "PR detection", "Watts + HR"],
  },
  {
    href: "/train/water",
    icon: Droplets,
    title: "Solo Water Trial",
    desc: "GPS-based solo time trials in OC, kayak, canoe, or single paddle craft.",
    color: "#06B6D4",
    badge: "GPS Ready",
    badgeVariant: "cyan" as const,
    features: ["GPS tracking", "Pace per 500m", "Conditions log", "Route save"],
  },
  {
    href: "/train/team",
    icon: Users,
    title: "Dragon Boat Practice",
    desc: "Log team practices with seat position, stroke rate, practice type, and notes.",
    color: "#F97316",
    badge: "Team",
    badgeVariant: "orange" as const,
    features: ["Seat position", "Practice type", "Stroke rate", "Coach feedback"],
  },
  {
    href: "/train/dryland",
    icon: Activity,
    title: "Dryland / Strength",
    desc: "Log gym and bodyweight exercises tailored for dragon boat paddlers.",
    color: "#10B981",
    badge: "Off Water",
    badgeVariant: "success" as const,
    features: ["Custom exercises", "Sets/reps/weight", "Progress tracking", "Paddle-specific"],
  },
];

const quickWorkouts = [
  { label: "500m Erg Test", href: "/train/erg?type=test&distance=500", time: "~3 min" },
  { label: "2k Erg Endurance", href: "/train/erg?type=test&distance=2000", time: "~9 min" },
  { label: "10×30s Starts", href: "/train/erg?type=intervals", time: "~20 min" },
  { label: "Solo 500m Time Trial", href: "/train/water?distance=500", time: "~3 min" },
];

export default function TrainPage() {
  return (
    <div className="py-6 flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#F1F5F9]">Train</h1>
        <p className="text-sm text-[#8A98AC] mt-1">Choose your training mode to log a session.</p>
      </div>

      {/* Quick Start */}
      <div>
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">Quick Start</h2>
        <div className="grid grid-cols-2 gap-2">
          {quickWorkouts.map((w) => (
            <Link
              key={w.label}
              href={w.href}
              className="flex flex-col gap-1 rounded-xl border border-[#1E293B] bg-[#0D1528] px-4 py-3 hover:border-[#334155] transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Timer size={12} className="text-[#0EA5E9]" />
                <span className="text-[10px] text-[#8A98AC]">{w.time}</span>
              </div>
              <span className="text-sm font-semibold text-[#F1F5F9]">{w.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Training Modes */}
      <div>
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-3">All Modes</h2>
        <div className="flex flex-col gap-4">
          {modes.map(({ href, icon: Icon, title, desc, color, badge, badgeVariant, features }) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5 hover:border-[#334155] transition-all hover:shadow-lg hover:shadow-black/20 block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                    <Icon size={22} style={{ color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#F1F5F9]">{title}</h3>
                      <Badge variant={badgeVariant} className="text-[10px]">{badge}</Badge>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#7C8AA0] mt-1 shrink-0" />
              </div>
              <p className="text-sm text-[#8A98AC] mb-3">{desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <span key={f} className="text-[10px] font-medium bg-[#1E293B] text-[#8A98AC] px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Workout Builder Teaser */}
      <Link
        href="/plans"
        className="flex items-center gap-3 rounded-xl border border-dashed border-[#334155] p-4 hover:border-[#7C8AA0] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl border border-dashed border-[#334155] flex items-center justify-center">
          <Plus size={16} className="text-[#8A98AC]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[#94A3B8]">View Training Plans</div>
          <div className="text-xs text-[#7C8AA0]">8 built-in plans for all levels</div>
        </div>
        <ChevronRight size={14} className="text-[#7C8AA0] ml-auto" />
      </Link>
    </div>
  );
}
