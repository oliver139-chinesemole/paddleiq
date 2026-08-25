import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Splits a duration into whole minutes and seconds.
 *
 * Rounding the total before splitting is what stops 179.6s formatting as
 * "2:60" — rounding the remainder on its own can carry into a full minute
 * that the minutes half never hears about.
 */
function minutesAndSeconds(seconds: number): { sign: string; m: number; s: number } {
  if (!Number.isFinite(seconds)) return { sign: "", m: 0, s: 0 };
  const total = Math.round(Math.abs(seconds));
  return {
    sign: seconds < 0 ? "-" : "",
    m: Math.floor(total / 60),
    s: total % 60,
  };
}

export function formatTime(seconds: number): string {
  const { sign, m, s } = minutesAndSeconds(seconds);
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secondsPer500m: number): string {
  return `${formatTime(secondsPer500m)}/500m`;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "0m";
  if (Math.abs(meters) >= 1000) return `${(meters / 1000).toFixed(2)}km`;
  return `${Math.round(meters)}m`;
}

/**
 * Reads a stored date as a local calendar day.
 *
 * `new Date("2026-06-15")` is parsed as UTC midnight, which is the *previous*
 * evening anywhere behind Greenwich — so every date in the app rendered a day
 * early in the Americas. Dates are stored as plain local YYYY-MM-DD, so they
 * have to be reconstructed in local time.
 */
export function parseLocalDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(date);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole calendar days from `from` to `to`, ignoring the time of day. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  // Rounding absorbs the 23- and 25-hour days either side of a DST change.
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function formatDate(date: string | Date): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDate(date: string | Date, now = new Date()): string {
  // Compared as calendar days rather than elapsed milliseconds: a session
  // logged this evening is still "Today", even though more than 24 hours have
  // passed since the start of the day it belongs to.
  const diffDays = calendarDaysBetween(parseLocalDate(date), now);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
}

export function calcPacePer500m(distanceM: number, durationSec: number): number {
  if (distanceM === 0) return 0;
  return (durationSec / distanceM) * 500;
}

export function strokeRateLabel(spm: number): string {
  if (spm < 50) return "Low";
  if (spm < 70) return "Medium";
  if (spm < 85) return "High";
  return "Sprint";
}

export function rpeLabel(rpe: number): string {
  if (rpe <= 3) return "Easy";
  if (rpe <= 5) return "Moderate";
  if (rpe <= 7) return "Hard";
  if (rpe <= 9) return "Very Hard";
  return "Max";
}

export function rpeColor(rpe: number): string {
  if (rpe <= 3) return "#10B981";
  if (rpe <= 5) return "#F59E0B";
  if (rpe <= 7) return "#F97316";
  return "#EF4444";
}
