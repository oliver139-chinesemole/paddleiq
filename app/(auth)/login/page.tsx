"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Demo mode: bypass auth for demo@paddleiq.com / demo
    if (form.email === "demo@paddleiq.com" || form.email) {
      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
      return;
    }

    setLoading(false);
    setError("Invalid email or password.");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0F1E]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-3xl font-black gradient-text">PaddleIQ</span>
          </Link>
          <p className="text-[#64748B] text-sm mt-2">Welcome back, athlete</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#94A3B8]">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#1E293B] bg-[#111827] px-4 pr-12 text-[#F1F5F9] text-sm placeholder:text-[#475569] outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8]"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3 text-sm text-[#EF4444]">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Logging in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Log in <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-[#475569]">
            <button className="text-[#0EA5E9] hover:underline">Forgot password?</button>
          </div>
        </div>

        {/* Demo hint */}
        <div className="mt-4 rounded-xl border border-[#1E293B] bg-[#111827] px-4 py-3 text-sm text-[#64748B]">
          <span className="text-[#0EA5E9] font-semibold">Demo mode:</span> Enter any email to access the dashboard without an account.
        </div>

        <p className="text-center text-sm text-[#475569] mt-6">
          New to PaddleIQ?{" "}
          <Link href="/signup" className="text-[#0EA5E9] font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
