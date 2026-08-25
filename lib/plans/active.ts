"use client";

// The athlete's currently active training plan.
//
// "Start This Plan" was component-local useState on the plans page, so it
// vanished on refresh and nothing else could see it — the dashboard had no way
// to know whether a plan was running, which is why its workout card was
// hardcoded.
//
// Stored in localStorage rather than the user_training_plans table because it
// has to work in demo mode and offline. Moving it server-side later is a matter
// of changing these two functions.

import { useSyncExternalStore } from "react";

const ACTIVE_PLAN_KEY = "paddleiq:activePlanId";

export function readActivePlan(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_PLAN_KEY);
}

const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Also track changes made in another tab.
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

export function writeActivePlan(planId: string | null): void {
  if (typeof window === "undefined") return;
  if (planId) window.localStorage.setItem(ACTIVE_PLAN_KEY, planId);
  else window.localStorage.removeItem(ACTIVE_PLAN_KEY);
  listeners.forEach((fn) => fn());
}

/**
 * Reads the active plan as an external store.
 *
 * Not an effect writing to state: that sets state synchronously during the
 * effect and cascades a render. Not a lazy useState initializer either, since
 * the server has no localStorage and the card's content depends on this — the
 * server snapshot below keeps hydration honest.
 */
export function useActivePlan(): string | null {
  return useSyncExternalStore(subscribe, readActivePlan, () => null);
}

export type DashboardPrompt =
  | { kind: "first-session" }
  | { kind: "active-plan"; planId: string }
  | { kind: "pick-plan" };

/**
 * What the dashboard's headline card should offer.
 *
 * It previously showed "4 × 500m Erg Intervals, target split 128–132s/500m"
 * to everyone, hardcoded — a specific prescription presented as personalised,
 * including to someone who had never logged a session. Each branch here is
 * something the app actually knows.
 */
export function dashboardPrompt(sessionCount: number, activePlanId: string | null): DashboardPrompt {
  if (sessionCount === 0) return { kind: "first-session" };
  if (activePlanId) return { kind: "active-plan", planId: activePlanId };
  return { kind: "pick-plan" };
}
