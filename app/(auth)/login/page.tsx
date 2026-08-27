"use client";

import { useState } from "react";
import { authErrorMessage } from "@/lib/auth/errors";
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

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Demo mode: no Supabase configured — just route to dashboard
    if (!supabaseConfigured) {
      router.push("/dashboard");
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (authError) {
        // Not authError.message: a network failure arrives here as
        // "Failed to fetch", which is the message an athlete on bad signal
        // would actually see.
        setError(authErrorMessage(authError));
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!form.email) { setError("Enter your email first."); return; }
    if (!supabaseConfigured) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setError("Password reset email sent — check your inbox.");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0F1E]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/"><span className="text-3xl font-black gradient-text">PaddleIQ</span></Link>
          <p className="text-[#8A98AC] text-sm mt-2">Welcome back, athlete</p>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" placeholder="you@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#94A3B8]">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#1E293B] bg-[#111827] px-4 pr-12 text-[#F1F5F9] text-sm placeholder:text-[#7C8AA0] outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition-colors"
                  required={supabaseConfigured}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C8AA0] hover:text-[#94A3B8]">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className={`rounded-xl px-4 py-3 text-sm border ${
                error.includes("sent") || error.includes("reset")
                  ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]"
                  : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
              }`}>
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Logging in…</>
              ) : (
                <>Log in <ArrowRight size={16} /></>
              )}
            </Button>
          </form>

          {supabaseConfigured && (
            <div className="mt-4 text-center">
              <button onClick={handleForgotPassword} className="text-sm text-[#0EA5E9] hover:underline">
                Forgot password?
              </button>
            </div>
          )}
        </div>

        {!supabaseConfigured && (
          <div className="mt-4 rounded-xl border border-[#1E293B] bg-[#111827] px-4 py-3 text-sm text-[#8A98AC]">
            <span className="text-[#0EA5E9] font-semibold">Demo mode</span> — Supabase not connected yet.
            Click Log in to explore with seed data. Add{" "}
            <code className="text-[#94A3B8] text-xs">NEXT_PUBLIC_SUPABASE_URL</code> to enable real accounts.
          </div>
        )}

        <p className="text-center text-sm text-[#7C8AA0] mt-6">
          New to PaddleIQ?{" "}
          <Link href="/signup" className="text-[#0EA5E9] font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
