"use client";

import Link from "next/link";
import { Trophy, ClipboardList, Megaphone, CalendarDays, X, BellOff } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { AppNotification, NotificationKind } from "@/lib/notifications/derive";

const ICONS: Record<NotificationKind, React.ElementType> = {
  pr: Trophy,
  assignment: ClipboardList,
  announcement: Megaphone,
  event: CalendarDays,
};

const COLORS: Record<NotificationKind, string> = {
  pr: "#F59E0B",
  assignment: "#0EA5E9",
  announcement: "#A855F7",
  event: "#10B981",
};

export function NotificationSheet({
  items,
  open,
  onClose,
  loading,
}: {
  items: AppNotification[];
  open: boolean;
  onClose: () => void;
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop sits above the top nav (z-40) and the bottom nav (z-50). */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Notifications"
        className="fixed z-[61] left-0 right-0 top-0 max-h-[80vh] overflow-y-auto bg-[#0A0F1E] border-b border-[#1E293B] rounded-b-2xl shadow-2xl animate-fade-in"
      >
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#F1F5F9]">Notifications</h2>
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="text-[#8A98AC] hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-[#8A98AC]">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <BellOff size={24} className="text-[#334155]" />
              <p className="text-sm text-[#8A98AC]">You&apos;re all caught up.</p>
              <p className="text-xs text-[#7C8AA0] max-w-xs">
                New personal records, assigned workouts, team announcements and upcoming sessions
                show up here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((n) => {
                const Icon = ICONS[n.kind];
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={onClose}
                      className="flex gap-3 rounded-2xl border border-[#1E293B] bg-[#111C2E] p-3 hover:border-[#334155] transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${COLORS[n.kind]}22` }}
                      >
                        <Icon size={16} style={{ color: COLORS[n.kind] }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-[#F1F5F9] truncate">{n.title}</span>
                          <span className="text-[10px] text-[#7C8AA0] shrink-0">
                            {formatRelativeDate(new Date(n.at))}
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">{n.body}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
