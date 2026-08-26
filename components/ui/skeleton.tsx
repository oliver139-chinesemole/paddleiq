import { cn } from "@/lib/utils";

/**
 * Placeholder block shown while a page's data resolves.
 *
 * These pages loaded their data in an effect and rendered zeroes until it
 * arrived, so an athlete with real history saw "0.0 km / 0 sessions" for a
 * moment before the numbers appeared — which reads as "you did nothing this
 * week" rather than "still loading".
 *
 * Skeletons are sized to match the content they stand in for, so nothing jumps
 * when the real values land.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-[#1E293B]", className)}
    />
  );
}

/** Card-shaped placeholder, matching the stat tiles used across the app. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16 mt-2" />
      <Skeleton className="h-3 w-14 mt-2" />
    </div>
  );
}

/** A list row, for recent sessions and record lists. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4", className)}>
      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20 mt-2" />
      </div>
      <Skeleton className="h-4 w-12 shrink-0" />
    </div>
  );
}

/**
 * Screen-reader announcement for a loading region.
 *
 * The skeletons themselves are aria-hidden — a screen reader shouldn't read out
 * a row of empty boxes — so the state needs saying once, in words.
 */
export function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}
