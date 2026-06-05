"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simulate signup → redirect to onboarding
    setTimeout(() => router.push("/onboarding"), 900);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0A0F1E]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-3xl font-black gradient-text">PaddleIQ</span>
          </Link>
          <p className="text-[#64748B] text-sm mt-2">Create your athlete profile</p>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Full name"
              type="text"
              placeholder="Alex Chen"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create Account <ArrowRight size={16} />
                </span>
              )}
            </Button>

            <p className="text-center text-xs text-[#475569]">
              By creating an account you agree to our{" "}
              <span className="text-[#0EA5E9]">Terms of Service</span> and{" "}
              <span className="text-[#0EA5E9]">Privacy Policy</span>.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-[#475569] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0EA5E9] font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
