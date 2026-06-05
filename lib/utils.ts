import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPace(secondsPer500m: number): string {
  const m = Math.floor(secondsPer500m / 60);
  const s = Math.round(secondsPer500m % 60);
  return `${m}:${s.toString().padStart(2, "0")}/500m`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)}km`;
  return `${meters}m`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
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
