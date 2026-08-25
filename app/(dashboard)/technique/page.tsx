"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, ChevronDown, Star, Check, Video, ScanLine, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { techniqueLessons } from "@/lib/data/seed";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Stroke Mechanics", "Power & Mechanics", "Team Synchronization", "Race Strategy", "Erg Training", "Technique & Position"];

const difficultyColor = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
} as const;

function TechniqueLibrary() {
  // Form check deep-links here as /technique?lesson=t2 to open the lesson
  // behind a specific finding.
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string | null>(searchParams.get("lesson"));
  const [category, setCategory] = useState("All");
  const [weeklyFocus, setWeeklyFocus] = useState<string | null>("t1");

  const filtered = techniqueLessons.filter(
    (l) => category === "All" || l.category === category
  );

  const lesson = selected ? techniqueLessons.find((l) => l.id === selected) : null;

  if (lesson) {
    return (
      <div className="py-6 flex flex-col gap-5 animate-fade-in">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelected(null)} className="text-sm text-[#0EA5E9] hover:underline flex items-center gap-1">
            ← Technique Library
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px]">{lesson.category}</Badge>
            <span className="text-[10px] font-semibold" style={{ color: difficultyColor[lesson.difficulty] }}>
              {lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#F1F5F9]">{lesson.title}</h1>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{lesson.summary}</p>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-5">
          <h2 className="text-sm font-bold text-[#F1F5F9] mb-3">Explanation</h2>
          <p className="text-sm text-[#94A3B8] leading-relaxed">{lesson.explanation}</p>
        </div>

        <div className="rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/5 p-5">
          <h2 className="text-sm font-bold text-[#EF4444] mb-3">Common Mistakes</h2>
          <ul className="flex flex-col gap-2">
            {lesson.common_mistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <span className="text-[#EF4444] mt-0.5 shrink-0">✗</span>
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 p-5">
          <h2 className="text-sm font-bold text-[#0EA5E9] mb-3">Coaching Cues</h2>
          <ul className="flex flex-col gap-2">
            {lesson.coaching_cues.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <span className="text-[#0EA5E9] mt-0.5 shrink-0">→</span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#10B981]/20 bg-[#10B981]/5 p-5">
          <h2 className="text-sm font-bold text-[#10B981] mb-3">Practice Drills</h2>
          <ul className="flex flex-col gap-2">
            {lesson.drills.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                <span className="text-[#10B981] font-bold mt-0.5 shrink-0">{i + 1}.</span>
                {d}
              </li>
            ))}
          </ul>
        </div>

        {/* Video Placeholder */}
        <div className="rounded-2xl border border-dashed border-[#334155] p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">▶</span>
          </div>
          <div className="text-sm font-semibold text-[#64748B]">Video Tutorial</div>
          <div className="text-xs text-[#475569] mt-1">Record and review your technique below.</div>
        </div>

        <Link href="/technique/video">
          <div className="flex items-center gap-3 rounded-xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/10 p-3 hover:bg-[#0EA5E9]/15 transition-colors cursor-pointer">
            <Video size={18} className="text-[#0EA5E9]" />
            <span className="text-sm font-semibold text-[#0EA5E9]">Open Video Review →</span>
          </div>
        </Link>

        <Button
          onClick={() => setWeeklyFocus(lesson.id)}
          variant={weeklyFocus === lesson.id ? "success" : "secondary"}
          className="w-full"
        >
          {weeklyFocus === lesson.id ? (
            <>
              <Check size={16} /> This Week&apos;s Focus ✓
            </>
          ) : (
            <>
              <Star size={16} /> Set as Weekly Focus
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#A855F7]/20 flex items-center justify-center">
          <BookOpen size={20} className="text-[#A855F7]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">Technique Library</h1>
          <p className="text-xs text-[#64748B]">Dragon boat stroke education</p>
        </div>
      </div>

      {/* Weekly Focus */}
      {weeklyFocus && (
        <div className="rounded-2xl bg-gradient-to-r from-[#A855F7]/20 to-[#0EA5E9]/20 border border-[#A855F7]/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star size={14} className="text-[#F59E0B]" />
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">This Week&apos;s Focus</span>
          </div>
          <h3 className="text-base font-bold text-[#F1F5F9]">
            {techniqueLessons.find((l) => l.id === weeklyFocus)?.title}
          </h3>
          <button
            onClick={() => setSelected(weeklyFocus)}
            className="text-xs text-[#0EA5E9] mt-1 hover:underline"
          >
            Review lesson →
          </button>
        </div>
      )}

      {/* Form Check card */}
      <Link href="/technique/form-check">
        <div className="flex items-center gap-4 rounded-2xl border border-[#0EA5E9]/30 bg-[#0EA5E9]/10 p-4 hover:border-[#0EA5E9]/50 transition-colors cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-[#0EA5E9]/20 flex items-center justify-center shrink-0">
            <ScanLine size={22} className="text-[#0EA5E9]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#F1F5F9]">Form Check</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Point your camera at yourself — or read a saved clip — and get your stroke measured</p>
          </div>
          <ChevronRight size={16} className="text-[#475569] shrink-0" />
        </div>
      </Link>

      {/* Team Sync card */}
      <Link href="/technique/team-sync">
        <div className="flex items-center gap-4 rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4 hover:border-[#334155] transition-colors cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-[#A855F7]/20 flex items-center justify-center shrink-0">
            <Users size={22} className="text-[#A855F7]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#F1F5F9]">Team Sync</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Film the boat side-on and see who&apos;s catching early or late, in milliseconds</p>
          </div>
          <ChevronRight size={16} className="text-[#475569] shrink-0" />
        </div>
      </Link>

      {/* Video Review card */}
      <Link href="/technique/video">
        <div className="flex items-center gap-4 rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4 hover:border-[#334155] transition-colors cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-[#0EA5E9]/20 flex items-center justify-center shrink-0">
            <Video size={22} className="text-[#0EA5E9]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#F1F5F9]">Video Review</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Record clips, review in slow motion, annotate your technique</p>
          </div>
          <ChevronRight size={16} className="text-[#475569] shrink-0" />
        </div>
      </Link>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0",
              category === cat
                ? "bg-[#0EA5E9] text-white"
                : "bg-[#1E293B] text-[#64748B] hover:bg-[#334155]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lessons List */}
      <div className="flex flex-col gap-3">
        {filtered.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => setSelected(lesson.id)}
            className="flex items-start gap-4 rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4 text-left hover:border-[#334155] transition-colors cursor-pointer w-full"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-[#F1F5F9]">{lesson.title}</h3>
                {weeklyFocus === lesson.id && <Star size={12} className="text-[#F59E0B] shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="secondary" className="text-[10px]">{lesson.category}</Badge>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: difficultyColor[lesson.difficulty] }}
                >
                  {lesson.difficulty}
                </span>
              </div>
              <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">{lesson.summary}</p>
            </div>
            <ChevronRight size={16} className="text-[#475569] mt-1 shrink-0" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-[#334155] p-4 text-center">
        <div className="text-sm text-[#64748B]">More technique lessons coming soon.</div>
        <div className="text-xs text-[#475569] mt-1">Drill libraries and coach review in development.</div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary or the production build fails on
// this statically-rendered route.
export default function TechniquePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-[#64748B]">Loading…</div>}>
      <TechniqueLibrary />
    </Suspense>
  );
}
