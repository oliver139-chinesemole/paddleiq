"use client";

import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueueHealth } from "@/hooks/useQueueHealth";
import { IS_CONFIGURED } from "@/hooks/useUser";
import { describeSyncStatus, type SyncTone } from "@/lib/db/sync-status";

const TONE = {
  ok:           { color: "#10B981", Icon: CheckCircle2 },
  waiting:      { color: "#0EA5E9", Icon: Cloud },
  "local-only": { color: "#8A98AC", Icon: CloudOff },
  problem:      { color: "#F59E0B", Icon: AlertTriangle },
} satisfies Record<SyncTone, { color: string; Icon: typeof Cloud }>;

/**
 * Where an athlete's sessions currently are.
 *
 * The queue has always known when sessions stopped reaching the server —
 * getQueueHealth and retryFailedItems were written for exactly this and then
 * never called from anywhere. Until now the only way to discover that syncing
 * had failed was to open the app on another device and find the sessions
 * missing.
 */
export function SyncStatus() {
  const { health, online, retry, retrying } = useQueueHealth();

  const status = describeSyncStatus({
    pending: health.pending,
    failed: health.failed,
    firstError: health.firstError,
    configured: IS_CONFIGURED,
    online,
  });

  const { color, Icon } = TONE[status.tone];

  return (
    <div className="mt-4 pt-4 border-t border-[#1E293B]">
      <div className="flex items-start gap-2.5">
        <Icon size={15} style={{ color }} className="shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          {/* Announced politely so a change of state reaches a screen reader
              without stealing focus — it is information, not an interruption. */}
          <p role="status" aria-live="polite" className="text-sm font-semibold" style={{ color }}>
            {status.title}
          </p>
          <p className="text-xs text-[#8A98AC] leading-relaxed mt-1">{status.detail}</p>

          {status.canRetry && (
            <Button
              variant="secondary"
              className="mt-3 gap-2 text-xs h-9"
              onClick={retry}
              disabled={retrying}
            >
              <RefreshCw size={13} className={retrying ? "animate-spin" : undefined} />
              {retrying ? "Retrying…" : "Try again"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
