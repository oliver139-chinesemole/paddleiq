"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="py-16 flex flex-col items-center gap-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#EF4444]/20 flex items-center justify-center">
        <AlertTriangle size={24} className="text-[#EF4444]" />
      </div>
      <div>
        <h2 className="text-base font-bold text-[#F1F5F9]">Something went wrong</h2>
        <p className="text-sm text-[#8A98AC] mt-1">Your data is safe. Try reloading this page.</p>
      </div>
      <Button onClick={reset} className="w-full max-w-xs">Reload</Button>
    </div>
  );
}
