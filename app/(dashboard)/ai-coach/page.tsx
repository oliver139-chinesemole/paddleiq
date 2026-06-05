"use client";

import { useState } from "react";
import { Zap, Send, Brain, TrendingUp, AlertTriangle, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const WEEKLY_SUMMARY = {
  insight: "Your 2k erg time improved by 12 seconds over the last 5 sessions. Your stroke rate is consistently increasing from 72 to 76 spm, which is the main driver. Your second 500m split fades by ~3 seconds compared to the first — this is your key area to address.",
  focus: "Pacing consistency in the 2k erg — specifically maintaining your split in the 500–1000m window.",
  warnings: [
    "Your last 3 sessions have been high-RPE (8+ out of 10). Consider adding a recovery paddle or easy technique session this week.",
    "You haven't logged any dryland sessions in 12 days. Strength work supports your paddle power.",
  ],
  suggestions: [
    "Try a pacing interval workout: 4×500m at a controlled split 5 seconds slower than your max, focus on consistent splits across all 4.",
    "Add a 20-min easy technique erg session with stroke rate capped at 65 spm for recovery.",
    "Your water time trial pace (156s/500m) is slower than your erg pace (128s/500m). Consider a boat-to-erg correlation session.",
  ],
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_QUESTIONS = [
  "How do I improve my 500m erg time?",
  "Why is my second 500m slower in the 2k?",
  "Build me a taper plan for a race in 2 weeks",
  "What dryland exercises should I prioritize?",
  "How often should I take recovery days?",
];

const AUTO_RESPONSES: Record<string, string> = {
  "How do I improve my 500m erg time?": "To improve your 500m erg, focus on three things:\n\n1. **Sprint Intervals** — 8–10 × 30-second max-effort pieces with 2+ minutes rest. These train your anaerobic system for the explosive 500m demand.\n\n2. **Stroke Rate Control** — At 500m pace (~85–92 spm), many paddlers sacrifice blade depth for speed. Focus on maintaining a clean, buried catch even at high rate.\n\n3. **Race Simulation** — Once a week, do a standalone 500m all-out with a full warmup. Track your split progression. Even a 1-second improvement per week adds up to 12 seconds in 3 months.",
  "Why is my second 500m slower in the 2k?": "This is extremely common. The 500–1000m segment (the 'black hole') is where glycogen depletion starts hitting. Your anaerobic system has run out of its peak output, and your aerobic system hasn't fully taken over yet.\n\nFix: Try 'negative split training' — deliberately pace your first 500m 4–5 seconds per 500m SLOWER than your max, then try to hold that pace or go faster through the 2k. Most paddlers find this uncomfortable at first but it pays off in consistent overall time.",
  "Build me a taper plan for a race in 2 weeks": "Here's a 2-week race taper for a 500m event:\n\n**Week 1 (14–8 days out)**\n• Mon: 500m test, easy warmup\n• Wed: 4×250m at race pace, 4 min rest\n• Fri: 30 min steady state, stroke focus\n• Sat: Team practice if available\n\n**Week 2 — Taper (7–0 days out)**\n• Mon: 2×500m at race pace, 5 min rest\n• Wed: 20 min easy with 3×30s starts\n• Fri: REST\n• Sat: 10 min easy paddle, race strategy review\n• Race Day: 15 min warmup, 2×30s starts, then race\n\nKey: reduce volume by 30–40%, keep intensity high, prioritize sleep from Day 4 onward.",
  "What dryland exercises should I prioritize?": "For dragon boat paddlers, prioritize in this order:\n\n1. **Pull-ups / Lat Pulldown** — The lat is your primary power muscle. Aim for 4×8–10 at controlled tempo.\n2. **Bent-over Rows** — Develops mid-back pull pattern essential for the drive phase.\n3. **Russian Twists / Cable Rotations** — Your torso rotation is where 60–70% of power comes from.\n4. **Deadlift** — Full posterior chain power for boat acceleration.\n5. **Core (Planks, Ab Wheel, Hollow Body)** — Stabilizes your body for efficient force transfer.\n\nDo 2–3 sessions per week, with at least 1 rest day between. Don't max out during race season — save peak strength work for the off-season.",
  "How often should I take recovery days?": "Based on your recent logs (5 sessions/week, average RPE 7.8), you're running close to your sustainable load. Here's what I'd suggest:\n\n- Take **at least 1 full rest day** per week (no training, just walking and stretching).\n- After any session rated RPE 9+, follow with a recovery day (light mobility, 20-min easy erg at 65 spm max).\n- Every 4th week, reduce volume by 30% for a deload week. This is where adaptation happens.\n- Signs you need extra recovery: sleep quality dropping, stroke rate declining for same effort, increased joint soreness.",
};

export default function AICoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  function sendMessage(text: string) {
    const userMsg = text.trim();
    if (!userMsg) return;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    const response = AUTO_RESPONSES[userMsg] ||
      `Thanks for your question about "${userMsg}". Based on your recent training data, I can see you've been training consistently. For a personalized answer, I'd need your Supabase account connected to analyze your full training history. In the meantime, check the Technique Library and Training Plans sections for specific guidance.`;

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setLoading(false);
    }, 1200);
  }

  return (
    <div className="py-6 flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#A855F7]/20 flex items-center justify-center">
          <Brain size={20} className="text-[#A855F7]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#F1F5F9]">AI Coach</h1>
          <p className="text-xs text-[#64748B]">Personalized training analysis</p>
        </div>
        <Badge variant="secondary" className="ml-auto text-[10px]">Demo Mode</Badge>
      </div>

      {/* Weekly Summary */}
      <div className="rounded-2xl border border-[#A855F7]/30 bg-[#A855F7]/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-[#A855F7]" />
          <h2 className="text-sm font-bold text-[#A855F7]">This Week&apos;s Summary</h2>
        </div>
        <p className="text-sm text-[#94A3B8] leading-relaxed mb-4">{WEEKLY_SUMMARY.insight}</p>

        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-[#0EA5E9]" />
          <span className="text-xs font-semibold text-[#0EA5E9]">Focus This Week</span>
        </div>
        <p className="text-xs text-[#64748B] mb-4">{WEEKLY_SUMMARY.focus}</p>

        {WEEKLY_SUMMARY.warnings.length > 0 && (
          <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} className="text-[#F59E0B]" />
              <span className="text-xs font-semibold text-[#F59E0B]">Watch Out</span>
            </div>
            {WEEKLY_SUMMARY.warnings.map((w, i) => (
              <p key={i} className="text-xs text-[#94A3B8] leading-relaxed mb-1">{w}</p>
            ))}
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={13} className="text-[#10B981]" />
            <span className="text-xs font-semibold text-[#10B981]">Suggestions</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {WEEKLY_SUMMARY.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#64748B]">
                <span className="text-[#10B981] mt-0.5 shrink-0">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Chat Section */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] flex flex-col" style={{ minHeight: "300px" }}>
        <div className="p-4 border-b border-[#1E293B]">
          <h2 className="text-sm font-bold text-[#F1F5F9]">Ask Your AI Coach</h2>
          <p className="text-xs text-[#64748B]">Questions about training, technique, pacing, or race prep</p>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 flex flex-col gap-3 max-h-80 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-xs text-[#475569] text-center py-4">
              Ask me anything about your dragon boat training…
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-[#0EA5E9] text-white rounded-br-sm"
                  : "bg-[#1E293B] text-[#F1F5F9] rounded-bl-sm"
              }`}>
                {msg.content.split("\n").map((line, j) => (
                  <span key={j}>
                    {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                    {j < msg.content.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#1E293B] rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#475569] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#1E293B] flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about training, technique, pacing…"
            className="flex-1 h-10 rounded-xl border border-[#1E293B] bg-[#111827] px-4 text-sm text-[#F1F5F9] placeholder:text-[#475569] outline-none focus:border-[#0EA5E9]"
          />
          <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* Starter Questions */}
      {messages.length === 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Common Questions</h2>
          <div className="flex flex-col gap-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-left text-sm rounded-xl border border-[#1E293B] bg-[#0D1528] px-4 py-3 text-[#94A3B8] hover:border-[#334155] hover:text-[#F1F5F9] transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#1E293B] p-4 text-center">
        <p className="text-xs text-[#475569]">
          <span className="text-[#A855F7] font-semibold">AI Coach</span> uses your training history to generate personalized insights.
          Connect Supabase for full AI analysis based on your real data.
        </p>
      </div>
    </div>
  );
}
