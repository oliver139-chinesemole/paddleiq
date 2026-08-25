import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-8 text-center bg-[#0A0F1E]">
      <div className="w-16 h-16 rounded-2xl bg-[#1E293B] flex items-center justify-center">
        <WifiOff size={28} className="text-[#8A98AC]" />
      </div>
      <div>
        <h1 className="text-xl font-black text-white mb-2">You&apos;re offline</h1>
        <p className="text-[#8A98AC] text-sm leading-relaxed">
          No connection detected. Any workouts you log will be saved locally and
          synced automatically when you reconnect.
        </p>
      </div>
      <Link href="/dashboard" className="bg-[#0EA5E9] text-white font-bold px-8 py-3 rounded-2xl text-sm">
        Go to Dashboard
      </Link>
    </div>
  );
}
