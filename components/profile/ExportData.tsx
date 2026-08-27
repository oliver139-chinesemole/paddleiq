"use client";

import { useState } from "react";
import { Download, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCSV, toExportRows, exportFilename, SESSION_COLUMNS } from "@/lib/export/csv";
import { toLocalDateStr } from "@/lib/utils";
import { SyncStatus } from "./SyncStatus";

type State = { kind: "idle" } | { kind: "working" } | { kind: "done"; rows: number } | { kind: "empty" } | { kind: "error" };

/**
 * Download the athlete's whole training history as a CSV.
 *
 * Most of this app's data lives in IndexedDB on one device, which means
 * "export" isn't a nicety — without it there is genuinely no way to get a
 * training log out, and no way to check what the app thinks it has recorded.
 *
 * The file is built in the browser from local data. Nothing is uploaded, which
 * is also why this works with no account and offline.
 */
export function ExportData({ userId, isDemoMode }: { userId: string; isDemoMode: boolean }) {
  // isDemoMode only changes the wording of the empty state. Export itself must
  // stay available: demo mode means Supabase isn't configured, so sessions
  // logged in that state exist *only* in this browser — which is precisely
  // when having a copy matters most.
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleExport() {
    setState({ kind: "working" });
    try {
      const { getAllSessionsForUser } = await import("@/lib/db/sessions");
      const bundle = await getAllSessionsForUser(userId);
      const rows = toExportRows(bundle);

      if (rows.length === 0) {
        setState({ kind: "empty" });
        return;
      }

      const csv = toCSV(rows, SESSION_COLUMNS);
      // The BOM makes Excel read it as UTF-8; without it, accented names and
      // any non-ASCII note come out mangled.
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = exportFilename(toLocalDateStr(new Date()));
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download in some browsers; a short
      // delay costs nothing and the object is freed either way.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setState({ kind: "done", rows: rows.length });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
      <h2 className="text-xs font-semibold text-[#8A98AC] uppercase tracking-wider mb-2">
        Your Data
      </h2>
      <p className="text-xs text-[#8A98AC] leading-relaxed mb-3">
        Download every session you have logged as a spreadsheet. Your training history is
        stored on this device, so this is the way to keep a copy, move to another phone, or
        send it to a coach.
      </p>

      <Button
        variant="secondary"
        className="w-full gap-2"
        onClick={handleExport}
        disabled={state.kind === "working"}
      >
        <Download size={16} />
        {state.kind === "working" ? "Preparing…" : "Export sessions (CSV)"}
      </Button>

      {/* Announced politely: the download itself gives no feedback a screen
          reader would pick up. */}
      <div role="status" aria-live="polite">
        {state.kind === "done" && (
          <p className="flex items-center gap-1.5 text-[11px] text-[#10B981] mt-2">
            <Check size={12} />
            Exported {state.rows} {state.rows === 1 ? "session" : "sessions"}.
          </p>
        )}
        {state.kind === "empty" && (
          <p className="text-[11px] text-[#8A98AC] mt-2">
            {isDemoMode
              ? "Nothing to export yet. The sessions shown around the app are sample data, not yours — anything you log yourself is saved on this device and will appear here."
              : "Nothing to export yet — log a session first."}
          </p>
        )}
        {state.kind === "error" && (
          <p className="flex items-center gap-1.5 text-[11px] text-[#EF4444] mt-2">
            <AlertCircle size={12} />
            Couldn&apos;t build the file. Try again.
          </p>
        )}
      </div>

      {/* Where those sessions actually live right now — the other half of the
          same question the export answers. */}
      <SyncStatus />
    </div>
  );
}
