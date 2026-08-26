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

/** The date the active plan was started, read the same way. */
export function useActivePlanStart(): string | null {
  return useSyncExternalStore(subscribe, readPlanStart, () => null);
}

export type DashboardPrompt =
  | { kind: "first-session" }
  | { kind: "active-plan"; planId: string }
  | { kind: "pick-plan" };

// ─── position within a plan ──────────────────────────────────────────────────

const STARTED_KEY = "paddleiq:activePlanStartedAt";

export function readPlanStart(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STARTED_KEY);
}

export function writePlanStart(date: string | null): void {
  if (typeof window === "undefined") return;
  if (date) window.localStorage.setItem(STARTED_KEY, date);
  else window.localStorage.removeItem(STARTED_KEY);
  listeners.forEach((fn) => fn());
}

/**
 * Which week of the plan the athlete is in, 1-based and clamped to the plan's
 * length so a plan run past its end keeps showing the final week rather than
 * disappearing.
 */
export function currentPlanWeek(
  startedOn: string | null,
  totalWeeks: number,
  now = new Date(),
): number {
  if (!startedOn || totalWeeks < 1) return 1;
  const start = new Date(`${startedOn}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 1;
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return 1;
  return Math.min(totalWeeks, Math.floor(days / 7) + 1);
}

/**
 * How far through the plan the athlete is, 0-100.
 *
 * Measured in elapsed days rather than whole weeks so the bar moves during a
 * week instead of jumping every Monday. Week 1 day 1 is 0% — nothing has been
 * done yet — and it clamps at 100 so a plan left running past its end doesn't
 * report 140% complete.
 *
 * The plans page used to render a hardcoded 15% and "Week 1" for every plan,
 * whatever week the athlete was actually in.
 */
export function planProgressPercent(
  startedOn: string | null,
  totalWeeks: number,
  now = new Date(),
): number {
  if (!startedOn || totalWeeks < 1) return 0;
  const start = new Date(`${startedOn}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return 0;
  return Math.min(100, Math.round((days / (totalWeeks * 7)) * 100));
}

/**
 * Day index within the training week, 1-based, Monday first.
 *
 * The plans are written Monday to Sunday, and getDay() puts Sunday at 0.
 */
export function trainingDayOfWeek(now = new Date()): number {
  const js = now.getDay();
  return js === 0 ? 7 : js;
}

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
