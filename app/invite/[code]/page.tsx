"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type State =
  | { id: "loading" }
  | { id: "found"; teamName: string; teamId: string }
  | { id: "not_found" }
  | { id: "joining" }
  | { id: "joined"; teamName: string }
  | { id: "already_member"; teamName: string }
  | { id: "error"; msg: string };

const IS_CONFIGURED =
  typeof window !== "undefined" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function InvitePage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<State>(() =>
    IS_CONFIGURED ? { id: "loading" } : { id: "not_found" }
  );

  useEffect(() => {
    if (!IS_CONFIGURED) return;
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();

      const { data: team } = await sb
        .from("teams")
        .select("id, name")
        .eq("invite_code", code.toLowerCase())
        .single();

      if (!team) { setState({ id: "not_found" }); return; }
      setState({ id: "found", teamName: team.name, teamId: team.id });
    })();
    // IS_CONFIGURED is a module constant, not reactive state.
  }, [code]);

  async function join() {
    if (state.id !== "found") return;
    setState({ id: "joining" });

    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();

    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      // Not logged in — send to signup preserving the invite code
      router.push(`/signup?invite=${code}`);
      return;
    }

    // Already on this team?
    const { data: existing } = await sb
      .from("team_members")
      .select("id")
      .eq("team_id", state.teamId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setState({ id: "already_member", teamName: state.teamName });
      return;
    }

    try {
      const { data: myProfile } = await sb.from("profiles").select("full_name").eq("id", user.id).single();
      await sb.from("team_members").insert({ team_id: state.teamId, user_id: user.id });
      await sb.from("profiles").update({ team_id: state.teamId }).eq("id", user.id);
      // Auto-post welcome to feed
      const joinerName = myProfile?.full_name ?? user.email?.split("@")[0] ?? "Someone";
      try { await sb.from("team_feed").insert({ team_id: state.teamId, author_id: user.id, post_type: "new_member", content: `${joinerName} joined the team! Welcome 🐉`, metadata: {} }); } catch { /* non-fatal */ }
      setState({ id: "joined", teamName: state.teamName });
      setTimeout(() => router.push("/team"), 1800);
    } catch {
      setState({ id: "error", msg: "Failed to join. Please try again." });
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        {/* Brand */}
        <span className="text-2xl font-black gradient-text">PaddleIQ</span>

        {state.id === "loading" && (
          <>
            <Loader2 size={40} className="text-[#0EA5E9] animate-spin" />
            <p className="text-sm text-[#8A98AC]">Looking up your invite…</p>
          </>
        )}

        {state.id === "found" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-[#F97316]/20 flex items-center justify-center">
              <span className="text-3xl">🐉</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-[#F1F5F9]">You&apos;ve been invited!</h1>
              <p className="text-[#8A98AC] text-sm mt-1">Join <span className="text-[#F1F5F9] font-semibold">{state.teamName}</span> on PaddleIQ</p>
            </div>
            <Button onClick={join} className="w-full">
              <Users size={16} /> Accept Invite
            </Button>
            <p className="text-xs text-[#7C8AA0]">
              Don&apos;t have an account?{" "}
              <button onClick={() => router.push(`/signup?invite=${code}`)} className="text-[#0EA5E9] hover:underline">
                Sign up first
              </button>
            </p>
          </>
        )}

        {state.id === "joining" && (
          <>
            <Loader2 size={40} className="text-[#0EA5E9] animate-spin" />
            <p className="text-sm text-[#8A98AC]">Joining the team…</p>
          </>
        )}

        {state.id === "joined" && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center">
              <CheckCircle size={32} className="text-[#10B981]" />
            </div>
            <h1 className="text-xl font-black text-[#F1F5F9]">You&apos;re in!</h1>
            <p className="text-[#8A98AC] text-sm">Welcome to <span className="text-[#F1F5F9] font-semibold">{state.teamName}</span>.</p>
            <p className="text-xs text-[#7C8AA0]">Redirecting to team…</p>
          </>
        )}

        {state.id === "already_member" && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#0EA5E9]/20 flex items-center justify-center">
              <CheckCircle size={32} className="text-[#0EA5E9]" />
            </div>
            <h1 className="text-xl font-black text-[#F1F5F9]">Already a member</h1>
            <p className="text-[#8A98AC] text-sm">You&apos;re already on <span className="text-[#F1F5F9] font-semibold">{state.teamName}</span>.</p>
            <Button onClick={() => router.push("/team")} className="w-full">Go to Team</Button>
          </>
        )}

        {state.id === "not_found" && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#EF4444]/20 flex items-center justify-center">
              <XCircle size={32} className="text-[#EF4444]" />
            </div>
            <h1 className="text-xl font-black text-[#F1F5F9]">Invalid invite</h1>
            <p className="text-[#8A98AC] text-sm">This invite link has expired or doesn&apos;t exist.</p>
            <Button variant="outline" onClick={() => router.push("/")} className="w-full">Go Home</Button>
          </>
        )}

        {state.id === "error" && (
          <>
            <XCircle size={40} className="text-[#EF4444]" />
            <p className="text-[#EF4444] text-sm">{state.msg}</p>
            <Button variant="outline" onClick={() => router.back()} className="w-full">Go Back</Button>
          </>
        )}
      </div>
    </div>
  );
}
