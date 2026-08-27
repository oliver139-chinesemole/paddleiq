/**
 * Turning an auth failure into something an athlete can act on.
 *
 * Both auth pages passed `authError.message` straight to the screen. Supabase
 * says sensible things for some failures and not for others, and a network
 * failure arrives as "Failed to fetch" — which is what an athlete signing in
 * on bad signal at a boathouse would actually see. This app is explicitly
 * built to work on a phone away from wifi, so that is not an edge case.
 *
 * Anything unrecognised falls back to a generic line rather than being shown
 * raw: an unfamiliar internal message is worse than no detail, because it
 * looks like something the athlete did wrong.
 */

const GENERIC = "Something went wrong. Please try again.";

const KNOWN: Array<[RegExp, string]> = [
  // Network. supabase-js returns this as an error rather than throwing, so it
  // never reached the catch block that had a decent message ready.
  [
    /failed to fetch|network ?error|load failed|networkrequestfailed/i,
    "Can't reach the server. Check your connection and try again.",
  ],
  [
    /invalid login credentials|invalid email or password/i,
    "That email or password isn't right.",
  ],
  [
    /email not confirmed/i,
    "Confirm your email first — check your inbox for the link.",
  ],
  [
    /user already registered|already been registered|already exists/i,
    "There's already an account with that email. Try logging in instead.",
  ],
  [
    /password should be at least|password is too short/i,
    "Passwords need to be at least 8 characters.",
  ],
  [
    /unable to validate email|invalid email/i,
    "That doesn't look like a valid email address.",
  ],
  [
    /rate limit|too many requests/i,
    "Too many attempts. Wait a minute and try again.",
  ],
];

export function authErrorMessage(raw: unknown): string {
  const text =
    raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  if (!text.trim()) return GENERIC;

  for (const [pattern, message] of KNOWN) {
    if (pattern.test(text)) return message;
  }
  return GENERIC;
}
