"use client";

import { EFFORT_LEVELS, storedToEffort, effortToStored } from "@/lib/effort";

/**
 * Five broad effort levels rather than a 1–10 row of numbers.
 *
 * Takes and returns the stored 1–10 value so callers don't need to know about
 * the mapping, and shows the cue for the current selection — the point of the
 * change is that "could you still talk?" is answerable where "was that a 6 or
 * a 7?" isn't.
 */
export function EffortPicker({
  value,
  onChange,
  label = "Effort",
  error,
}: {
  /** Stored RPE, 1–10. */
  value: string;
  onChange: (storedRpe: string) => void;
  label?: string;
  error?: string;
}) {
  const current = storedToEffort(Number(value));
  const selected = EFFORT_LEVELS.find((e) => e.level === current);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#94A3B8]">{label}</label>

      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {EFFORT_LEVELS.map((e) => {
          const active = e.level === current;
          return (
            <button
              key={e.level}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${e.label} — ${e.cue}`}
              onClick={() => onChange(String(effortToStored(e.level)))}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-colors ${
                active
                  ? "border-transparent text-[#0A0F1E]"
                  : "border-[#1E293B] bg-[#111827] text-[#94A3B8] hover:border-[#334155]"
              }`}
              style={active ? { backgroundColor: e.color } : undefined}
            >
              <span className="text-base font-black leading-none">{e.level}</span>
              <span className="text-[9px] font-semibold leading-tight text-center px-0.5">
                {e.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* The cue for whatever is selected — this is the part that makes the
          question answerable rather than a guess. */}
      <p className="text-xs text-[#8A98AC] min-h-[1rem]">
        {selected ? selected.cue : ""}
      </p>

      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  );
}
