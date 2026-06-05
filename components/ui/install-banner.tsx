"use client";

import { X, Download, Share } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallBanner() {
  const { install, dismiss, dismissed } = useInstallPrompt();

  if (dismissed || install.status === "unavailable") return null;

  return (
    <div className="fixed bottom-[72px] inset-x-0 z-40 px-4 pb-2 pointer-events-none">
      <div className="pointer-events-auto max-w-lg mx-auto rounded-2xl bg-[#0D1528] border border-[#334155] shadow-2xl p-4 flex items-start gap-3 animate-fade-in">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0D9488] flex items-center justify-center shrink-0">
          <span className="text-lg">🐉</span>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#F1F5F9]">Install PaddleIQ</p>
          {install.status === "android" && (
            <>
              <p className="text-xs text-[#64748B] mt-0.5">Add to your home screen for the full app experience — offline included.</p>
              <button
                onClick={() => { install.prompt(); dismiss(); }}
                className="mt-2.5 flex items-center gap-1.5 bg-[#0EA5E9] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#0284C7] transition-colors"
              >
                <Download size={12} />
                Add to Home Screen
              </button>
            </>
          )}
          {install.status === "ios" && (
            <>
              <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                Tap <Share size={11} className="inline mx-0.5 text-[#0EA5E9]" /> <strong className="text-[#94A3B8]">Share</strong> at the bottom of your browser, then <strong className="text-[#94A3B8]">Add to Home Screen</strong>.
              </p>
            </>
          )}
        </div>

        {/* Dismiss */}
        <button onClick={dismiss} className="text-[#475569] hover:text-[#94A3B8] shrink-0 mt-0.5">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
