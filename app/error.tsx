"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/20 flex items-center justify-center">
        <AlertTriangle size={28} className="text-[#EF4444]" />
      </div>
      <div>
        <h1 className="text-xl font-black text-[#F1F5F9]">Something went wrong</h1>
        <p className="text-sm text-[#8A98AC] mt-2 max-w-xs">
          An unexpected error occurred. Your local data is safe.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={reset} className="w-full">Try Again</Button>
        <Button variant="outline" onClick={() => { window.location.href = "/dashboard"; }} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
