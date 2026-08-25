import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke tests over the running app.
 *
 * These codify the manual browser checks that found most of this codebase's
 * real bugs — a bell wired to nothing, dates rendering a day early, a form
 * defaulting to tomorrow, a trim reading of 239kg on a 375kg boat. None of
 * those were visible to the unit suite, because each one was a correct
 * calculation over a wrong input, or a component nobody had rendered.
 *
 * Rules of thumb for adding here:
 *  - assert what a user would notice, not implementation detail
 *  - keep it deterministic; no retries are configured, so flake is a bug
 *  - don't load the pose model (17MB), which is far too slow for CI
 */

const ROUTES = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/train",
  "/train/erg",
  "/train/water",
  "/train/team",
  "/train/dryland",
  "/records",
  "/analytics",
  "/plans",
  "/profile",
  "/team",
  "/technique",
  "/technique/form-check",
  "/technique/team-sync",
  "/technique/video",
  "/onboarding",
  "/legal/privacy",
  "/legal/terms",
];

/** Collects console errors and uncaught exceptions for the life of a page. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // A missing favicon or an aborted prefetch isn't an app defect.
    if (/favicon|net::ERR_ABORTED/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

/** Local YYYY-MM-DD — the format sessions are stored in. */
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

test.describe("every route renders", () => {
  for (const route of ROUTES) {
    test(`${route} loads without errors`, async ({ page }) => {
      const errors = watchForErrors(page);
      const response = await page.goto(route, { waitUntil: "networkidle" });

      expect(response?.status(), `${route} should not error`).toBeLessThan(400);

      const body = await page.locator("body").innerText();
      // Placeholder leakage: each of these has shipped to users at some point.
      expect(body, `${route} renders NaN`).not.toMatch(/\bNaN\b/);
      expect(body, `${route} renders undefined`).not.toMatch(/\bundefined\b/);
      expect(body, `${route} renders [object Object]`).not.toContain("[object Object]");
      expect(body.trim().length, `${route} is near-empty`).toBeGreaterThan(50);

      expect(errors, `${route} console errors`).toEqual([]);
    });
  }
});

test.describe("logging a session", () => {
  // Regression: these defaulted to the UTC date, offering tomorrow to anyone
  // logging after ~5pm in the Americas — exactly when people log training.
  for (const route of ["/train/erg", "/train/water", "/train/team", "/train/dryland"]) {
    test(`${route} defaults to today's local date`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      const date = page.locator('input[type="date"]').first();
      await expect(date).toBeVisible();
      expect(await date.inputValue()).toBe(localToday());
    });
  }

  test("the erg form offers a way to save", async ({ page }) => {
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /save erg session/i })).toBeVisible();
  });
});

test.describe("notifications", () => {
  // Regression: the bell had no click handler and an unconditional dot, so it
  // advertised a notification that never existed and never cleared.
  test("the bell opens a panel and the unread dot clears", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    const bell = page.locator('button[aria-label*="Notification"]').first();
    await expect(bell).toBeVisible();

    const dot = page.locator('button[aria-label*="Notification"] span.rounded-full');
    await expect(dot).toHaveCount(1);

    await bell.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /close notifications/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Marked as seen, and it must stay seen across a reload.
    await expect(dot).toHaveCount(0);
    await page.reload({ waitUntil: "networkidle" });
    await expect(dot).toHaveCount(0);
  });
});

test.describe("technique library", () => {
  test("a lesson deep link opens that lesson", async ({ page }) => {
    // Form check findings link here as /technique?lesson=t2.
    await page.goto("/technique?lesson=t2", { waitUntil: "networkidle" });
    await expect(page.locator("h1").first()).toHaveText(/torso rotation/i);
  });

  test("a lesson shows the animated stroke with its own caption", async ({ page }) => {
    await page.goto("/technique?lesson=t2", { waitUntil: "networkidle" });
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText(/power comes from the trunk/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /show this lesson/i })).toBeVisible();
  });

  test("form check and team sync are reachable from the library", async ({ page }) => {
    await page.goto("/technique", { waitUntil: "networkidle" });
    // Matched by href rather than text: "Team Sync" also appears inside the
    // "Team Synchronization" category filter and lesson badge.
    await expect(page.locator('a[href="/technique/form-check"]')).toBeVisible();
    await expect(page.locator('a[href="/technique/team-sync"]')).toBeVisible();
  });
});

test.describe("lineup balance", () => {
  // Regression: bow/stern trim reported 239kg on a boat carrying 375kg,
  // because rows were split into halves rather than weighted by distance
  // from the centre.
  test("auto-balance reports a plausible trim", async ({ page }) => {
    await page.goto("/team", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /lineups/i }).first().click();

    const autoBalance = page.getByRole("button", { name: /auto-balance/i });
    await expect(autoBalance).toBeVisible();
    await autoBalance.click();

    const panel = page.getByText("BOW / STERN TRIM").locator("..");
    await expect(panel).toBeVisible();

    const text = await page.locator("body").innerText();
    const total = Number(text.match(/(\d+) kg of paddlers aboard/)?.[1] ?? 0);
    const trim = Number(text.match(/BOW \/ STERN TRIM\s*\n?\s*([\d.]+)kg/)?.[1] ?? 0);
    expect(total).toBeGreaterThan(0);
    // Trim can never sensibly approach the whole crew's weight.
    expect(trim).toBeLessThan(total / 2);
  });
});
