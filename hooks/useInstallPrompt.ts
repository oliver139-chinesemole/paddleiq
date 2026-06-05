"use client";

import { useState, useEffect } from "react";

type InstallState =
  | { status: "unavailable" }           // not installable (already installed or unsupported)
  | { status: "android"; prompt: () => Promise<void> }  // beforeinstallprompt captured
  | { status: "ios" };                  // iOS — must use manual share sheet

export function useInstallPrompt(): { install: InstallState; dismiss: () => void; dismissed: boolean } {
  const [install, setInstall] = useState<InstallState>({ status: "unavailable" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already installed (standalone display mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if user already dismissed the banner this session
    if (sessionStorage.getItem("install-banner-dismissed")) {
      setDismissed(true);
      return;
    }

    // iOS detection — must use Share sheet manually
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      setInstall({ status: "ios" });
      return;
    }

    // Android / Chrome — capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      const deferredPrompt = e as any;
      setInstall({
        status: "android",
        prompt: async () => {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") setInstall({ status: "unavailable" });
        },
      });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("install-banner-dismissed", "1");
  }

  return { install, dismiss, dismissed };
}
