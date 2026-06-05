"use client";

import { useState, useEffect, useCallback } from "react";
import { Crown, Heart, Pin, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { FeedPostType } from "@/lib/types";

// ── Demo feed ─────────────────────────────────────────────────────────────────
const DEMO_POSTS = [
  { id: "f1", post_type: "announcement" as FeedPostType, author_name: "Coach Sarah", content: "Practice this Saturday at 7am — all paddlers required. Bring race gear.", created_at: "2026-06-05T06:00:00Z", is_pinned: true, reactions: { kudos: ["m1", "m2", "m3"] }, metadata: {} },
  { id: "f2", post_type: "pr"           as FeedPostType, author_name: "Sam Rivera",  content: "Sam Rivera just set a new 500m erg PR: 1:57 🎉", created_at: "2026-06-04T18:30:00Z", is_pinned: false, reactions: { kudos: ["m1", "m5"] }, metadata: { distance: 500, time: 117 } },
  { id: "f3", post_type: "announcement" as FeedPostType, author_name: "Coach Sarah", content: "Erg test scores due by Friday. Upload your 500m result to the team page.", created_at: "2026-06-04T09:00:00Z", is_pinned: false, reactions: { kudos: [] }, metadata: {} },
  { id: "f4", post_type: "new_member"   as FeedPostType, author_name: "PaddleIQ",    content: "Morgan Liu joined the team! Welcome 🐉", created_at: "2026-06-03T14:00:00Z", is_pinned: false, reactions: { kudos: ["m1", "m2", "m3", "m4"] }, metadata: {} },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Post = {
  id: string;
  post_type: FeedPostType;
  author_name?: string;
  author_id?: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  reactions: { kudos: string[] };
  metadata: Record<string, unknown>;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_LABEL: Record<FeedPostType, string> = {
  announcement: "", pr: "🏆 PR", milestone: "🎯 Milestone", new_member: "👋 Welcome", pin: "📌 Pinned",
};
const TYPE_COLOR: Record<FeedPostType, string> = {
  announcement: "#64748B", pr: "#F59E0B", milestone: "#A855F7", new_member: "#10B981", pin: "#0EA5E9",
};

// ── Single post card ──────────────────────────────────────────────────────────
function PostCard({ post, userId, isDemoMode, onKudos, onPin, isCoach }: {
  post: Post; userId: string; isDemoMode: boolean; isCoach: boolean;
  onKudos: (id: string, kudos: string[]) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const hasKudosed = post.reactions.kudos.includes(userId);
  const kudosCount = post.reactions.kudos.length;
  const accentColor = TYPE_COLOR[post.post_type];

  function toggleKudos() {
    const newKudos = hasKudosed
      ? post.reactions.kudos.filter(id => id !== userId)
      : [...post.reactions.kudos, userId];
    onKudos(post.id, newKudos);
  }

  return (
    <div className={`rounded-2xl border bg-[#0D1528] overflow-hidden ${post.is_pinned ? "border-[#0EA5E9]/30" : "border-[#1E293B]"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            {post.is_pinned && <Pin size={11} className="text-[#0EA5E9] shrink-0" />}
            {post.post_type !== "announcement" && (
              <span className="text-[10px] font-semibold" style={{ color: accentColor }}>
                {TYPE_LABEL[post.post_type]}
              </span>
            )}
            <span className="text-xs font-semibold text-[#94A3B8]">{post.author_name ?? "Team"}</span>
          </div>
          <span className="text-[10px] text-[#475569] shrink-0">{timeAgo(post.created_at)}</span>
        </div>

        <p className="text-sm text-[#F1F5F9] leading-relaxed">{post.content}</p>

        {/* Reactions row */}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={toggleKudos}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              hasKudosed ? "text-[#EF4444]" : "text-[#475569] hover:text-[#EF4444]"
            }`}
          >
            <Heart size={13} fill={hasKudosed ? "currentColor" : "none"} />
            {kudosCount > 0 && kudosCount}
          </button>
          {isCoach && (
            <button
              onClick={() => onPin(post.id, !post.is_pinned)}
              className={`text-xs transition-colors ${post.is_pinned ? "text-[#0EA5E9]" : "text-[#334155] hover:text-[#0EA5E9]"}`}
            >
              <Pin size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FeedTab ───────────────────────────────────────────────────────────────────
export default function FeedTab({
  teamId, userId, authorName, isCoach, isDemoMode,
}: {
  teamId: string;
  userId: string;
  authorName: string;
  isCoach: boolean;
  isDemoMode: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const loadPosts = useCallback(async () => {
    if (isDemoMode) { setPosts(DEMO_POSTS); return; }
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data } = await sb
        .from("team_feed")
        .select("id, post_type, author_id, content, created_at, is_pinned, reactions, metadata, profiles(full_name)")
        .eq("team_id", teamId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      setPosts((data ?? []).map((p: any) => ({
        id: p.id,
        post_type: p.post_type as FeedPostType,
        author_id: p.author_id,
        author_name: p.profiles?.full_name ?? "Team",
        content: p.content,
        created_at: p.created_at,
        is_pinned: p.is_pinned,
        reactions: p.reactions ?? { kudos: [] },
        metadata: p.metadata ?? {},
      })));
    } finally {
      setLoading(false);
    }
  }, [teamId, isDemoMode]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const newPost: Post = {
        id: `local-${Date.now()}`,
        post_type: "announcement",
        author_id: userId,
        author_name: authorName,
        content: text.trim(),
        created_at: new Date().toISOString(),
        is_pinned: false,
        reactions: { kudos: [] },
        metadata: {},
      };

      if (!isDemoMode) {
        const { createClient } = await import("@/lib/supabase/client");
        const sb = createClient();
        const { data } = await sb
          .from("team_feed")
          .insert({ team_id: teamId, author_id: userId, content: text.trim(), post_type: "announcement" })
          .select("id")
          .single();
        if (data) newPost.id = data.id;
      }

      setPosts(prev => [newPost, ...prev]);
      setText("");
    } finally {
      setPosting(false);
    }
  }

  async function handleKudos(postId: string, newKudos: string[]) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: { ...p.reactions, kudos: newKudos } } : p));
    if (!isDemoMode) {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      await sb.from("team_feed").update({ reactions: { kudos: newKudos } }).eq("id", postId);
    }
  }

  async function handlePin(postId: string, pinned: boolean) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_pinned: pinned } : p)
      .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
    if (!isDemoMode) {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      await sb.from("team_feed").update({ is_pinned: pinned }).eq("id", postId);
    }
    toast.success(pinned ? "Post pinned" : "Post unpinned");
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="text-[#0EA5E9] animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Post composer */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#0D1528] p-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) post(); }}
          placeholder="Post an update, announcement, or shout-out…"
          rows={3}
          className="w-full bg-transparent text-sm text-[#F1F5F9] placeholder-[#475569] resize-none outline-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[#334155]">⌘↵ to post</span>
          <Button size="sm" disabled={!text.trim() || posting} onClick={post} className="gap-1.5">
            {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Post
          </Button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-10 text-[#334155] text-sm">No posts yet. Say something!</div>
      ) : (
        posts.map(p => (
          <PostCard
            key={p.id}
            post={p}
            userId={userId}
            isDemoMode={isDemoMode}
            isCoach={isCoach}
            onKudos={handleKudos}
            onPin={handlePin}
          />
        ))
      )}
    </div>
  );
}
