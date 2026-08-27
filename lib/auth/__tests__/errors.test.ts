import { describe, it, expect } from "vitest";
import { authErrorMessage } from "../errors";

describe("authErrorMessage", () => {
  it("explains a network failure in words an athlete can act on", () => {
    // Regression: supabase-js returns this as an error rather than throwing,
    // so it bypassed the catch block and "Failed to fetch" reached the screen.
    // This app is built for a phone at a boathouse; that is not an edge case.
    const msg = authErrorMessage("Failed to fetch");
    expect(msg).toMatch(/can't reach the server/i);
    expect(msg).not.toMatch(/fetch/i);
  });

  it("covers how different browsers phrase a network failure", () => {
    for (const raw of ["Failed to fetch", "NetworkError when attempting to fetch", "Load failed"]) {
      expect(authErrorMessage(raw), raw).toMatch(/can't reach the server/i);
    }
  });

  it("says which of the two things was wrong, without saying which", () => {
    // Naming the wrong field would tell an attacker which emails exist.
    const msg = authErrorMessage("Invalid login credentials");
    expect(msg).toMatch(/email or password/i);
  });

  it("points an existing user at the login page", () => {
    expect(authErrorMessage("User already registered")).toMatch(/try logging in/i);
  });

  it("handles an unconfirmed email", () => {
    expect(authErrorMessage("Email not confirmed")).toMatch(/check your inbox/i);
  });

  it("translates a short password", () => {
    expect(authErrorMessage("Password should be at least 6 characters"))
      .toMatch(/at least 8 characters/i);
  });

  it("explains rate limiting rather than looking broken", () => {
    expect(authErrorMessage("Request rate limit reached")).toMatch(/too many attempts/i);
  });

  it("hides an unfamiliar internal message", () => {
    // Raw internals read as something the athlete did wrong.
    const msg = authErrorMessage("PGRST301: JWSError JWSInvalidSignature");
    expect(msg).toBe("Something went wrong. Please try again.");
    expect(msg).not.toMatch(/JWS|PGRST/);
  });

  it("copes with nothing useful to work from", () => {
    expect(authErrorMessage(undefined)).toMatch(/something went wrong/i);
    expect(authErrorMessage(null)).toMatch(/something went wrong/i);
    expect(authErrorMessage("")).toMatch(/something went wrong/i);
    expect(authErrorMessage("   ")).toMatch(/something went wrong/i);
  });

  it("accepts an Error as well as a string", () => {
    expect(authErrorMessage(new Error("Failed to fetch"))).toMatch(/can't reach the server/i);
  });
});
