import Link from "next/link";
import { ArrowRight, Zap, Target, Users, TrendingUp, Award, Timer } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F1F5F9]">
      {/* Header */}
      <header className="border-b border-[#1E293B] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black gradient-text">PaddleIQ</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors font-medium"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-[#0EA5E9]/20"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 rounded-full px-4 py-1.5 text-sm text-[#0EA5E9] font-medium mb-6">
          <Zap size={14} />
          Built exclusively for dragon boat athletes
        </div>
        <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
          Train Smarter.
          <br />
          <span className="gradient-text">Paddle Faster.</span>
        </h1>
        <p className="text-[#94A3B8] text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
          PaddleIQ is the all-in-one training platform for dragon boat athletes.
          Track erg sessions, water time trials, team practices, and improve your
          technique — whether you train solo or with a team.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold px-8 py-4 rounded-xl transition-colors text-base shadow-xl shadow-[#0EA5E9]/25"
          >
            Start Training Free
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 border border-[#1E293B] hover:bg-[#1E293B] text-[#F1F5F9] font-semibold px-8 py-4 rounded-xl transition-colors text-base"
          >
            View Demo Dashboard
          </Link>
        </div>
      </section>

      {/* Stats Banner */}
      <div className="border-y border-[#1E293B] bg-[#0D1528] py-8 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "200m–2k", label: "Race Distances" },
            { value: "4 Modes", label: "Erg / Water / Team / Dryland" },
            { value: "8 Plans", label: "Built-in Training Plans" },
            { value: "15+ Tips", label: "Technique Library" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-black text-[#0EA5E9]">{s.value}</div>
              <div className="text-xs text-[#64748B] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-black text-center mb-4">Everything a dragon boat athlete needs</h2>
        <p className="text-[#64748B] text-center mb-12 max-w-xl mx-auto">
          Purpose-built for paddlers. Not a generic fitness app.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Timer, color: "#0EA5E9",
              title: "Erg Training Mode",
              desc: "Log split times, stroke rate, watts, and RPE. Track PRs across 200m, 500m, 1k, 2k. Compare sessions over time.",
            },
            {
              icon: Target, color: "#06B6D4",
              title: "Water Time Trials",
              desc: "GPS-based solo time trials in OC, kayak, or canoe. Track pace, speed, and conditions. Compare across sessions.",
            },
            {
              icon: Users, color: "#F97316",
              title: "Team Dragon Boat",
              desc: "Log team practices with seat position, practice type, stroke rate, and coach feedback.",
            },
            {
              icon: TrendingUp, color: "#10B981",
              title: "Analytics & Progress",
              desc: "Charts for weekly volume, erg PR progression, stroke rate trends, and training load.",
            },
            {
              icon: Award, color: "#F59E0B",
              title: "Personal Records",
              desc: "Automatic PR detection across erg and water distances. See how much you've improved.",
            },
            {
              icon: Zap, color: "#A855F7",
              title: "AI Coach",
              desc: "Weekly training summaries, pacing advice, overtraining alerts, and personalized suggestions.",
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-6 hover:border-[#334155] transition-colors">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <h3 className="font-bold text-[#F1F5F9] mb-2">{title}</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Training Plans */}
      <section className="px-6 py-16 bg-[#0D1528] border-y border-[#1E293B]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black mb-3">Built-in Training Plans</h2>
          <p className="text-[#64748B] mb-10 text-sm">Start a plan, follow the schedule, track your progress.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              "Dragon Boat Foundation",
              "500m Race Prep",
              "Erg Improvement",
              "Tryout Prep",
              "200m Sprint Plan",
              "Off-Season Strength",
              "Solo Time Trial",
              "In-Season Maintenance",
            ].map((plan) => (
              <div key={plan} className="rounded-xl border border-[#1E293B] bg-[#0A0F1E] p-3 text-sm font-medium text-[#94A3B8] text-left">
                {plan}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center max-w-xl mx-auto">
        <h2 className="text-3xl font-black mb-4">
          Ready to train with purpose?
        </h2>
        <p className="text-[#64748B] mb-8">
          Join paddlers tracking their performance with PaddleIQ.
          Free to start. No credit card needed.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold px-10 py-4 rounded-xl transition-colors text-base shadow-xl shadow-[#0EA5E9]/25"
        >
          Create Free Account
          <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#475569]">
          <span className="font-bold gradient-text">PaddleIQ</span>
          <span>Built for dragon boat athletes worldwide.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-[#F1F5F9] transition-colors">Log in</Link>
            <Link href="/signup" className="hover:text-[#F1F5F9] transition-colors">Sign up</Link>
            <Link href="/dashboard" className="hover:text-[#F1F5F9] transition-colors">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
