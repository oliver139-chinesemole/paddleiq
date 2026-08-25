import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

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

  // Regression: submitting an empty form saved a session of 0m in 0s and
  // navigated to the dashboard as though it had worked. Those rows fed weekly
  // totals, the streak, ACWR and PR detection.
  const EMPTY_SUBMITS: Array<[string, RegExp, RegExp]> = [
    ["/train/erg", /save erg session/i, /how far did you go/i],
    ["/train/water", /^save/i, /how long did it take/i],
    ["/train/team", /^save/i, /how long was practice/i],
    ["/train/dryland", /^save/i, /how long was the session/i],
  ];

  for (const [route, button, message] of EMPTY_SUBMITS) {
    test(`${route} refuses an empty submit`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      await page.locator("button").filter({ hasText: button }).last().click();

      // Must stay put and say why, rather than silently storing zeroes.
      await expect(page.getByText(message)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(route);
    });
  }
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

  test("a lesson points you at filming your own stroke", async ({ page }) => {
    // The synthetic stick-figure animation was removed: it could show the
    // order of the four phases but not blade angle, depth or what a clean
    // catch looks like — which is what these lessons are about. Comparing
    // your own clip against the cues teaches what a diagram can't.
    await page.goto("/technique?lesson=t1", { waitUntil: "networkidle" });
    await expect(page.getByText(/see it on your own stroke/i)).toBeVisible();
    await expect(page.locator('a[href="/technique/video"]')).toBeVisible();
    await expect(page.locator('a[href="/technique/form-check"]')).toBeVisible();
  });

  test("form check and team sync are reachable from the library", async ({ page }) => {
    await page.goto("/technique", { waitUntil: "networkidle" });
    // Matched by href rather than text: "Team Sync" also appears inside the
    // "Team Synchronization" category filter and lesson badge.
    await expect(page.locator('a[href="/technique/form-check"]')).toBeVisible();
    await expect(page.locator('a[href="/technique/team-sync"]')).toBeVisible();
  });
});

test.describe("accessibility", () => {
  // Guards the rules that were actually broken and are now fixed. Kept to a
  // named list rather than "no violations at all" so the suite stays honest:
  // colour contrast on the primary button is a live, known failure and a
  // pending design decision, not something to quietly allow through a filter.
  const RULES = ["label", "select-name", "button-name", "link-name", "meta-viewport"];

  const ROUTES = [
    "/login", "/dashboard", "/train/erg", "/train/water", "/train/team",
    "/train/dryland", "/technique", "/technique/video", "/profile", "/onboarding",
  ];

  for (const route of ROUTES) {
    test(`${route} has labelled controls and allows zoom`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).withRules(RULES).analyze();

      const detail = results.violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.html.replace(/\s+/g, " ").slice(0, 80)}`)
      );
      expect(detail, `${route} accessibility violations`).toEqual([]);
    });
  }
});

test.describe("training plans", () => {
  // Regression: plans advertised 4–12 weeks and shipped with at most one week
  // of content. Three of the five had none, and the page said "full
  // week-by-week schedule coming soon" without rendering the week it had.
  test("every plan has its full schedule browsable", async ({ page }) => {
    await page.goto("/plans", { waitUntil: "networkidle" });
    await page.locator("button").filter({ hasText: /Erg Improvement/ }).first().click();

    // Advertised as ten weeks, so ten weeks must be reachable.
    await expect(page.getByRole("button", { name: /^Week \d+$/ })).toHaveCount(10);
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);

    // A late week must hold real sessions, not an empty shell.
    await page.getByRole("button", { name: "Week 9" }).click();
    await expect(page.getByText(/Week 9 of 10/)).toBeVisible();
  });

  test("starting a plan puts today's session on the dashboard", async ({ page }) => {
    await page.goto("/plans", { waitUntil: "networkidle" });
    await page.locator("button").filter({ hasText: /Dragon Boat Foundation/ }).first().click();
    await page.locator("button").filter({ hasText: /Start This Plan/i }).first().click();

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    // Names the plan and the week, rather than the hardcoded prescription the
    // card used to show every athlete.
    await expect(page.getByText(/dragon boat foundation · week 1/i)).toBeVisible();
  });
});

test.describe("GPS tracking", () => {
  // The landing page advertised "GPS-based time trials" while the water form
  // was manual entry only, and the page carried a "coming in next update"
  // placeholder. This covers the round trip.
  test("records a paddle and fills the form in", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 37.865, longitude: -122.315, accuracy: 5 });

    await page.goto("/train/water", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /start gps tracking/i }).click();
    await expect(page.getByRole("button", { name: /stop and fill in the form/i })).toBeVisible();

    // ~18 km/h: 5m per second. Slower than the 35 km/h jump filter, faster than
    // the 2m noise floor, so every fix should be kept.
    const METRE = 1 / 111_320;
    let lat = 37.865;
    for (let i = 0; i < 6; i++) {
      lat += 5 * METRE;
      await context.setGeolocation({ latitude: lat, longitude: -122.315, accuracy: 5 });
      await page.waitForTimeout(1000);
    }

    await page.getByRole("button", { name: /stop and fill in the form/i }).click();

    // Duration lands in the form, and the route is drawn.
    const seconds = page.locator('input[placeholder="Seconds"]');
    await expect.poll(async () => Number(await seconds.inputValue())).toBeGreaterThan(0);
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("a denied permission falls back to manual entry", async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto("/train/water", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /start gps tracking/i }).click();

    // Must explain itself and leave the manual fields usable, not dead-end.
    await expect(page.getByText(/by hand below/i)).toBeVisible();
    await expect(page.locator('input[placeholder="Minutes"]')).toBeEditable();
  });
});

test.describe("offline", () => {
  /**
   * Waits until the service worker is actually *controlling* the page.
   *
   * Waiting only for `registration.active` was a race: an activated worker
   * isn't necessarily controlling the client yet, so on a slower runner the
   * caching navigation went straight to the network and nothing was cached.
   * The SW sets clientsClaim, so `controller` is the honest signal.
   */
  async function waitForServiceWorker(page: Page) {
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg?.active && !!navigator.serviceWorker.controller;
      },
      undefined,
      { timeout: 30_000 }
    );
  }

  test("the precache excludes the MediaPipe assets", async ({ page }) => {
    // Regression: globPublicPatterns defaults to everything under public/, so
    // adding the pose models and wasm there put ~48MB into the precache. Every
    // visitor downloaded it on first load, whether or not they opened Form
    // Check. Those are fetched on demand instead.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await waitForServiceWorker(page);

    const precached: string[] = await page.evaluate(async () => {
      const names = await caches.keys();
      const out: string[] = [];
      for (const n of names) {
        const keys = await (await caches.open(n)).keys();
        out.push(...keys.map((r) => new URL(r.url).pathname));
      }
      return out;
    });

    expect(precached.length).toBeGreaterThan(0);
    expect(precached.filter((p) => p.startsWith("/mediapipe/"))).toEqual([]);
    // The document fallback needs this, or an offline navigation has nothing
    // to serve and fails outright.
    expect(precached).toContain("/offline");
  });

  test("navigating offline degrades instead of failing", async ({ page, context }) => {
    // Regression: with no route caching and no precached fallback, every
    // offline navigation died with ERR_FAILED — in an app that ships an
    // offline page, an install banner and a sync queue.
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await waitForServiceWorker(page);
    // Now that the worker is controlling, this navigation is the one that
    // actually gets cached.
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.waitForTimeout(500); // let the cache write settle

    await context.setOffline(true);
    try {
      await page.goto("/train/erg", { waitUntil: "domcontentloaded" });

      // Asserted on what rendered, not on response.status(): a navigation
      // served by a service worker legitimately reports no response object in
      // Playwright, so checking the status made a passing case look like a
      // failure. What matters is that something usable came back — the real
      // page or the offline fallback — rather than ERR_FAILED.
      const body = await page.locator("body").innerText();
      expect(body.length, "offline navigation rendered nothing").toBeGreaterThan(50);
      expect(body).not.toMatch(/ERR_(FAILED|INTERNET_DISCONNECTED)/);
    } finally {
      await context.setOffline(false);
    }
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
