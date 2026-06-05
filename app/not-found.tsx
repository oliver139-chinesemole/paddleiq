import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-6 gap-6 text-center">
      <span className="text-6xl">🐉</span>
      <div>
        <h1 className="text-3xl font-black text-[#F1F5F9]">404</h1>
        <p className="text-sm text-[#64748B] mt-2">This page doesn&apos;t exist or has been moved.</p>
      </div>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-sm font-semibold text-[#0EA5E9] hover:underline"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>
    </div>
  );
}
