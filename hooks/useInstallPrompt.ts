"use client";

import { useState, useEffect } from "react";

type InstallState =
  | { status: "unavailable" }           // not installable (already installed or unsupported)
  | { status: "android"; prompt: () => Promise<void> }  // beforeinstallprompt captured
  | { status: "ios" };                  // iOS — must use manual share sheet

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectInitialInstallState(): InstallState {
  if (typeof window === "undefined") return { status: "unavailable" };
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true) {
    return { status: "unavailable" };
  }
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return { status: "ios" };
  return { status: "unavailable" };
}

export function useInstallPrompt(): { install: InstallState; dismiss: () => void; dismissed: boolean } {
  const [install, setInstall] = useState<InstallState>(detectInitialInstallState);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && !!sessionStorage.getItem("install-banner-dismissed")
  );

  useEffect(() => {
    // Only wire up the Android beforeinstallprompt listener
    if (typeof window === "undefined") return;
    if (dismissed || install.status !== "unavailable") return;

    const handler = (e: Event) => {
      e.preventDefault();
      const deferredPrompt = e as BeforeInstallPromptEvent;
      setInstall({
        status: "android",
        prompt: async () => {
          await deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") setInstall({ status: "unavailable" });
        },
      });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed, install.status]);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("install-banner-dismissed", "1");
  }

  return { install, dismiss, dismissed };
}
