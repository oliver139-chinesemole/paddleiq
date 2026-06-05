"use client";
/**
 * useUser — returns the currently authenticated Supabase user.
 *
 * Falls back gracefully when Supabase is not configured (demo mode):
 *   - isDemoMode = true
 *   - user = DEMO_USER (so all downstream code keeps working with seed data)
 */
import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

const IS_CONFIGURED =
  typeof window !== "undefined" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const DEMO_USER_ID = "demo-user-local";
export const DEMO_USER: User = {
  id: DEMO_USER_ID,
  email: "demo@paddleiq.com",
  app_metadata: {},
  user_metadata: { full_name: "Demo Athlete" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!IS_CONFIGURED) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    let cancelled = false;

    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();

      supabase.auth.getUser().then(({ data }) => {
        if (!cancelled) setUser(data.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        if (!cancelled) setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => { cancelled = true; subscription.unsubscribe(); };
    });
  }, []);

  return {
    user,
    loading,
    isDemoMode: !IS_CONFIGURED,
    userId: user?.id ?? DEMO_USER_ID,
  };
}
