"use client";

import { Suspense, useState } from "react";
import { authErrorMessage } from "@/lib/auth/errors";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const afterSignup = inviteCode ? `/invite/${inviteCode}` : "/onboarding";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!supabaseConfigured) {
      router.push(afterSignup);
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name } },
      });
      if (authError) {
        // Not authError.message: a network failure arrives here as
        // "Failed to fetch", which is the message an athlete on bad signal
        // would actually see.
        setError(authErrorMessage(authError));
        setLoading(false);
      } else {
        setDone(true);
        setTimeout(() => router.push(afterSignup), 1500);
      }
    } catch (err) {
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0F1E] gap-4">
        <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#10B981]" />
        </div>
        <h2 className="text-xl font-black text-white">Account created!</h2>
        <p className="text-[#8A98AC] text-sm text-center">
          Check your email for a confirmation link, then come back to finish setup.
        </p>
        <p className="text-[#7C8AA0] text-xs">
          {inviteCode ? "Redirecting to team invite…" : "Redirecting to onboarding…"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0F1E]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/"><span className="text-3xl font-black gradient-text">PaddleIQ</span></Link>
          <p className="text-[#8A98AC] text-sm mt-2">
            {inviteCode ? "Create an account to join your team" : "Create your athlete profile"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" type="text" placeholder="Alex Chen" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            {/* Only collected when there's somewhere to send it. Asking for a
                password that is discarded teaches people it protects something. */}
            {supabaseConfigured && (
              <Input label="Password" type="password" placeholder="At least 8 characters"
                minLength={8}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            )}

            {error && (
              <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3 text-sm text-[#EF4444]">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading
                ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating account…</>
                : <>{supabaseConfigured ? "Create Account" : "Continue without an account"} <ArrowRight size={16} /></>}
            </Button>

            <p className="text-center text-xs text-[#7C8AA0]">
              By signing up you agree to our{" "}
              <Link href="/legal/terms" className="text-[#0EA5E9] underline underline-offset-2">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/legal/privacy" className="text-[#0EA5E9] underline underline-offset-2">Privacy Policy</Link>.
            </p>
          </form>
        </div>

        {/* Login has carried this notice for a while; signup never did. So a
            visitor filled in a name, an email and a password under "Create
            your athlete profile", was sent to onboarding, and had every reason
            to believe they had an account — when nothing was created, nothing
            was stored, and their training would live in this browser alone
            until they found that out the hard way on another device. */}
        {!supabaseConfigured && (
          <div className="mt-4 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 px-4 py-3 text-sm text-[#8A98AC]">
            <span className="text-[#F59E0B] font-semibold">No accounts yet</span>{" "}
            — this deployment has no database connected, so nothing here creates a login. You can
            still use the whole app: sessions are saved in this browser and can be exported
            from your profile, but they won&apos;t follow you to another device.
          </div>
        )}

        <p className="text-center text-sm text-[#7C8AA0] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0EA5E9] font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
        <span className="h-8 w-8 rounded-full border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
