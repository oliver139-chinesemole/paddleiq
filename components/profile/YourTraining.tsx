"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Sliders, ChevronRight } from "lucide-react";
import {
  subscribePreferences,
  getPreferencesSnapshot,
  getPreferencesServerSnapshot,
  hasPreferences,
  roleLabel,
  envLabel,
  goalLabel,
  distanceLabel,
} from "@/lib/profile/preferences";

function Chips({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase font-semibold text-[#8A98AC] mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="rounded-full bg-[#1E293B] px-2.5 py-1 text-[11px] font-medium text-[#C3CEDC]"
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * What the athlete told onboarding about how they train.
 *
 * Showing it back matters beyond decoration: onboarding asks four questions
 * and says it will personalise things, and until now the answers were dropped
 * unless Supabase was configured. Displaying them is how an athlete can tell
 * the app actually kept them — and the edit link is what makes them changeable
 * rather than fixed at signup.
 */
export function YourTraining() {
  // localStorage doesn't exist on the server, so this needs a separate server
  // snapshot for the markup React sends to match what it hydrates. Reading in
  // an effect and setting state would work too, but re-renders on every mount.
  const prefs = useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getPreferencesServerSnapshot,
  );

  const role = roleLabel(prefs.role);

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
      <div className="flex items-center gap-2 mb-1">
        <Sliders size={14} className="text-[#7C8AA0]" />
        <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider">
          How You Train
        </h2>
      </div>

      {!hasPreferences(prefs) ? (
        <>
          <p className="text-xs text-[#8A98AC] leading-relaxed mt-2 mb-3">
            You haven&apos;t told us how you train yet. Four quick questions and the app can
            point its plans and coaching at what you&apos;re actually working toward.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:underline"
          >
            Set your preferences <ChevronRight size={13} />
          </Link>
        </>
      ) : (
        <>
          {role && (
            <div className="mt-2 text-sm font-bold text-[#F1F5F9]">{role}</div>
          )}
          <Chips label="Trains" values={prefs.trainingEnv.map(envLabel)} />
          <Chips label="Working on" values={prefs.goals.map(goalLabel)} />
          <Chips label="Races" values={prefs.preferredDistances.map(distanceLabel)} />

          <Link
            href="/onboarding"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:underline"
          >
            Edit preferences <ChevronRight size={13} />
          </Link>
        </>
      )}
    </div>
  );
}
