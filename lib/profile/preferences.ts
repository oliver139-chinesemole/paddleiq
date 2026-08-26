/**
 * The athlete's onboarding answers, kept on this device.
 *
 * Onboarding asks four questions and opens by promising "We'll personalize
 * your experience based on how you train" — then saved the answers only when
 * Supabase was configured. It isn't on the deployed site, so every athlete who
 * has completed onboarding there has had all four answers discarded on the way
 * to the dashboard.
 *
 * Preferences are a few hundred bytes and are read during render, so they live
 * in localStorage rather than Dexie: synchronous, no schema version to
 * migrate, and available before the first paint.
 *
 * Everything that touches the stored string is defensive. This data outlives
 * the code that wrote it — it survives upgrades, and a shape from an older
 * build (or a hand-edited value) must degrade to "no preference" rather than
 * throw during a render.
 */

export const PREFERENCES_KEY = "paddleiq.preferences.v1";

export type Role = "paddler" | "coach" | "captain" | "beginner" | "competitive";

export interface Preferences {
  role?: Role;
  /** Where they train: team_boat, erg, solo_water, dryland. */
  trainingEnv: string[];
  /** What they're working toward: endurance, technique, erg_score, race, … */
  goals: string[];
  /** Race distances in metres. */
  preferredDistances: number[];
  /** ISO timestamp of the last save, for showing when this was set. */
  updatedAt?: string;
}

export const EMPTY_PREFERENCES: Preferences = {
  trainingEnv: [],
  goals: [],
  preferredDistances: [],
};

const ROLES: Role[] = ["paddler", "coach", "captain", "beginner", "competitive"];

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Coerce whatever was stored into a usable Preferences object.
 *
 * Exported separately from the localStorage access so the validation can be
 * tested without a DOM, and so a caller reading from somewhere else (a future
 * server profile, an imported file) can reuse it.
 */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return EMPTY_PREFERENCES;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_PREFERENCES;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return EMPTY_PREFERENCES;
  }

  const obj = parsed as Record<string, unknown>;
  const role = typeof obj.role === "string" && (ROLES as string[]).includes(obj.role)
    ? (obj.role as Role)
    : undefined;

  return {
    role,
    trainingEnv: asStringArray(obj.trainingEnv),
    goals: asStringArray(obj.goals),
    // Distances arrive as strings from the onboarding options; keep only
    // values that are actually numbers, so a stray entry can't become NaN and
    // render as "NaNm" on a plan.
    preferredDistances: (Array.isArray(obj.preferredDistances) ? obj.preferredDistances : [])
      .map((d) => (typeof d === "number" ? d : Number(d)))
      .filter((d) => Number.isFinite(d) && d > 0),
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
  };
}

/** True when the athlete has actually told us something. */
export function hasPreferences(p: Preferences): boolean {
  return (
    !!p.role ||
    p.trainingEnv.length > 0 ||
    p.goals.length > 0 ||
    p.preferredDistances.length > 0
  );
}

/**
 * Read the stored preferences. Returns empties on the server, where there is
 * no localStorage, so callers don't need their own guard.
 */
export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return EMPTY_PREFERENCES;
  try {
    return parsePreferences(window.localStorage.getItem(PREFERENCES_KEY));
  } catch {
    // Private browsing and some embedded webviews throw on access rather than
    // returning null. Losing preferences is acceptable; a crash is not.
    return EMPTY_PREFERENCES;
  }
}

/** Persist preferences. Returns false if storage was unavailable. */
export function savePreferences(p: Preferences, now: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ ...p, updatedAt: now }),
    );
    notifyPreferencesChanged();
    return true;
  } catch {
    return false;
  }
}

export function clearPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFERENCES_KEY);
    notifyPreferencesChanged();
  } catch {
    // Nothing useful to do; the caller is signing out either way.
  }
}

/** Build Preferences from the raw onboarding answer map. */
export function fromOnboardingAnswers(
  answers: Record<string, string | string[] | undefined>,
): Preferences {
  const role = typeof answers.role === "string" && (ROLES as string[]).includes(answers.role)
    ? (answers.role as Role)
    : undefined;

  return {
    role,
    trainingEnv: asStringArray(answers.env),
    goals: asStringArray(answers.goals),
    preferredDistances: asStringArray(answers.distance)
      .map(Number)
      .filter((d) => Number.isFinite(d) && d > 0),
  };
}

/** Turn Preferences back into the answer map, so onboarding can prefill. */
export function toOnboardingAnswers(p: Preferences): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {
    env: p.trainingEnv,
    goals: p.goals,
    distance: p.preferredDistances.map(String),
  };
  if (p.role) answers.role = p.role;
  return answers;
}

const ROLE_LABELS: Record<Role, string> = {
  paddler: "Paddler",
  coach: "Coach",
  captain: "Team Captain",
  beginner: "Beginner",
  competitive: "Competitive Racer",
};

const ENV_LABELS: Record<string, string> = {
  team_boat: "Dragon Boat",
  erg: "Paddle Erg",
  solo_water: "Solo Water",
  dryland: "Dryland / Gym",
};

const GOAL_LABELS: Record<string, string> = {
  endurance: "Build Endurance",
  technique: "Improve Technique",
  erg_score: "Better Erg Score",
  race: "Race Readiness",
  team: "Make the Team",
  fitness: "General Fitness",
};

export const roleLabel = (r?: Role) => (r ? ROLE_LABELS[r] : undefined);
/** Falls back to the raw value so an unknown option still reads as something. */
export const envLabel = (v: string) => ENV_LABELS[v] ?? v;
export const goalLabel = (v: string) => GOAL_LABELS[v] ?? v;
export const distanceLabel = (m: number) => (m >= 1000 ? `${m / 1000}km` : `${m}m`);

/* ── Reading preferences from React ─────────────────────────────────────────
 *
 * Preferences live outside React, in localStorage, and can change in another
 * tab. useSyncExternalStore is the supported way to read that: it gives a
 * consistent value across a render, re-renders on change, and takes a separate
 * server snapshot so the markup React sends matches what it hydrates.
 *
 * The alternative — read in an effect and setState — causes a cascading render
 * on every mount and is what the lint rule about synchronous setState in an
 * effect is pointing at.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

// getSnapshot must return a referentially stable value or React re-renders
// forever, so the parsed object is cached against the raw string it came from.
let cachedRaw: string | null = null;
let cachedValue: Preferences = EMPTY_PREFERENCES;

export function subscribePreferences(listener: Listener): () => void {
  listeners.add(listener);
  // 'storage' only fires in *other* tabs, which is exactly what it's for here;
  // same-tab writes notify through savePreferences.
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

export function getPreferencesSnapshot(): Preferences {
  if (typeof window === "undefined") return EMPTY_PREFERENCES;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREFERENCES_KEY);
  } catch {
    return EMPTY_PREFERENCES;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parsePreferences(raw);
  }
  return cachedValue;
}

/** The server has no localStorage, so it always renders the empty state. */
export function getPreferencesServerSnapshot(): Preferences {
  return EMPTY_PREFERENCES;
}

/** Tell subscribers in this tab that preferences changed. */
export function notifyPreferencesChanged(): void {
  for (const l of listeners) l();
}
