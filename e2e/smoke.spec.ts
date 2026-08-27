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
  // This used to check a named list of five rules rather than the whole
  // ruleset, because colour contrast was a live known failure and filtering it
  // out silently would have been dishonest. That failure is fixed — the
  // destructive badge measured 3.97:1 against its own tint, and the legal
  // pages had links in prose distinguished only by colour — so the suite now
  // asserts the real thing: no WCAG 2.1 AA violations at all.
  //
  // If this starts failing, the fix is the markup, not the filter.
  const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

  const ROUTES = [
    "/", "/login", "/signup", "/dashboard", "/train", "/train/erg", "/train/water",
    "/train/team", "/train/dryland", "/records", "/analytics", "/plans", "/profile",
    "/team", "/technique", "/technique/video", "/onboarding",
    "/legal/privacy", "/legal/terms", "/offline",
  ];

  for (const route of ROUTES) {
    test(`${route} meets WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

      const detail = results.violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id} [${v.impact}]: ${n.html.replace(/\s+/g, " ").slice(0, 80)}`)
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
   * The predicate has to stay synchronous. An `async` one returns a Promise,
   * and `waitForFunction` tests the returned value for truthiness without
   * awaiting it — a Promise is always truthy, so `waitForFunction(async () =>
   * false)` resolves on the first poll. An earlier version of this helper was
   * async and therefore never waited for anything; the offline test failed
   * roughly one full-suite run in three with ERR_INTERNET_DISCONNECTED,
   * because it went offline while the worker was still installing.
   *
   * `navigator.serviceWorker.controller` is a synchronous property and is the
   * honest signal anyway: the SW sets clientsClaim, and a non-null controller
   * means this document's requests go through it.
   */
  async function waitForServiceWorker(page: Page) {
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, {
      timeout: 30_000,
    });
  }

  /** True once `path` is in any cache. Uses evaluate, which does await. */
  async function isCached(page: Page, path: string) {
    return page.evaluate(async (p) => {
      for (const name of await caches.keys()) {
        if (await (await caches.open(name)).match(p)) return true;
      }
      return false;
    }, path);
  }

  test("the precache excludes the MediaPipe assets", async ({ page }) => {
    // Regression: globPublicPatterns defaults to everything under public/, so
    // adding the pose models and wasm there put ~48MB into the precache. Every
    // visitor downloaded it on first load, whether or not they ever opened Form
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
    // A fresh document can start out uncontrolled, so re-establish it here
    // rather than assuming control carries across the navigation.
    await waitForServiceWorker(page);

    // Wait for the cache entry itself instead of sleeping a fixed interval.
    // A 500ms sleep was enough on an idle machine and not when the rest of the
    // suite runs beside it. The write either landed or it didn't.
    await expect
      .poll(() => isCached(page, "/train/erg"), { timeout: 15_000 })
      .toBe(true);

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

test.describe("race projections", () => {
  test("turns a distance with no PR into a target instead of a dash", async ({ page }) => {
    await page.goto("/records");

    // The demo athlete has erg PRs at 500m, 1k and 2k but not 200m, so that
    // card is where a projection should appear.
    const card = page.getByTestId("pr-erg-200");
    await expect(card).toContainText(/~\d+:\d\d/);
    await expect(card).toContainText("/500m target");
    await expect(card).not.toContainText("No PR yet");
  });

  test("leaves a real PR alone", async ({ page }) => {
    await page.goto("/records");
    // A projection is prefixed with ~; an actual result must never be.
    const card = page.getByTestId("pr-erg-2000");
    await expect(card).toContainText("8:32");
    await expect(card).not.toContainText("~");
  });

  test("reads the athlete's endurance profile off their PRs", async ({ page }) => {
    await page.goto("/records");
    const panel = page.getByRole("heading", { name: "Your Endurance Profile" }).locator("..").locator("..");

    await expect(panel).toContainText(/Balanced|Endurance-leaning|Speed-leaning/);
    // The fitted exponent is the whole point; a fallback would print 1.06 flat.
    await expect(panel).toContainText(/fade rate is 1\.\d{3}/);
    await expect(panel).toContainText("Fitted to 3 PRs");
  });

  test("projected times are plausible, not NaN or zero", async ({ page }) => {
    await page.goto("/records", { waitUntil: "networkidle" });
    const projected = page.getByText(/^~\d+:\d\d$/);
    // count() doesn't auto-retry, and the page now shows a skeleton while it
    // reads IndexedDB — wait for the content before counting it.
    await expect(projected.first()).toBeVisible();
    const count = await projected.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const text = await projected.nth(i).innerText();
      expect(text).not.toContain("NaN");
      expect(text).not.toMatch(/^~0:00$/);
    }
  });
});

test.describe("data export", () => {
  test("downloads a session an athlete actually logged", async ({ page }) => {
    // The round trip that matters: log a session, then get it back out as a
    // file. Unit tests cover the CSV shape; this covers the wiring — reading
    // from IndexedDB, building the blob, and the browser accepting a download.
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("2000");

    const mins = page.locator('input[type="number"]').nth(1);
    const secs = page.locator('input[type="number"]').nth(2);
    await mins.fill("8");
    await secs.fill("0");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });

    await page.goto("/profile", { waitUntil: "networkidle" });

    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByRole("button", { name: /export sessions/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^paddleiq-sessions-\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    expect(csv).toContain("Date,Type,Distance (m)");
    expect(csv).toContain("erg");
    expect(csv).toContain("2000");
    // Placeholder leakage would make the file useless in a spreadsheet.
    expect(csv).not.toContain("undefined");
    expect(csv).not.toContain("NaN");

    // The effort column must hold a value the five-level picker can produce.
    // A default of 7 (left from the old 1-10 slider) showed "Very hard" while
    // storing something no selection maps to, and fed that into training load.
    const effort = csv.split("\r\n")[1].split(",")[8];
    expect([2, 4, 6, 8, 10]).toContain(Number(effort));

    await expect(page.getByText(/Exported 1 session\./)).toBeVisible();
  });

  test("says so plainly when there is nothing to export", async ({ page }) => {
    // A fresh browser has an empty IndexedDB; the sample sessions shown
    // elsewhere are seed data and deliberately not part of the export.
    await page.goto("/profile", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /export sessions/i }).click();
    await expect(page.getByText(/Nothing to export yet/)).toBeVisible();
  });

  test("export stays available without an account", async ({ page }) => {
    // Demo mode means Supabase isn't configured, so anything logged lives only
    // in this browser — the case where a local copy matters most.
    await page.goto("/profile", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /export sessions/i })).toBeEnabled();
  });
});

test.describe("training preferences", () => {
  /** Walks the four onboarding steps, picking the first option on each. */
  async function completeOnboarding(page: Page) {
    await page.goto("/onboarding", { waitUntil: "networkidle" });
    for (let i = 0; i < 4; i++) {
      await page.locator("button").filter({ hasText: /^(Paddler|Dragon Boat|Build Endurance|200m)/ }).first().click();
      await page.getByRole("button", { name: /continue|go to dashboard|save preferences/i }).first().click();
    }
    await page.waitForURL(/dashboard|profile/, { timeout: 15_000 });
  }

  test("keeps the answers onboarding collected", async ({ page }) => {
    // Regression: onboarding saved only when Supabase was configured, so on
    // the deployed site all four answers were discarded on the way to the
    // dashboard — right after promising to personalise things with them.
    await completeOnboarding(page);

    await page.goto("/profile", { waitUntil: "networkidle" });
    const panel = page.getByRole("heading", { name: /how you train/i }).locator("..").locator("..");
    await expect(panel).toContainText("Paddler");
    await expect(panel).toContainText("Dragon Boat");
    await expect(panel).not.toContainText(/haven't told us/i);
  });

  test("prefills those answers when you go back to edit", async ({ page }) => {
    // Otherwise revisiting silently overwrites four saved answers.
    await completeOnboarding(page);

    await page.goto("/onboarding", { waitUntil: "networkidle" });
    await expect(page.getByText(/editing your preferences/i)).toBeVisible();
    // Already-answered, so Continue is available without picking anything.
    await expect(page.getByRole("button", { name: /continue/i }).first()).toBeEnabled();
  });

  test("invites you to set them when you haven't", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "networkidle" });
    const panel = page.getByRole("heading", { name: /how you train/i }).locator("..").locator("..");
    await expect(panel).toContainText(/haven't told us how you train/i);
    await expect(panel.locator('a[href="/onboarding"]')).toBeVisible();
  });

  test("every settings row goes somewhere real", async ({ page }) => {
    // Regression: all four pointed at "#". A settings menu where nothing
    // opens reads as a broken app.
    await page.goto("/profile", { waitUntil: "networkidle" });
    const links = page.locator('a[href^="/"]');
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    expect(hrefs).toContain("/legal/privacy");
    expect(hrefs).toContain("/legal/terms");
    expect(await page.locator('a[href="#"]').count(), "no dead links").toBe(0);
  });

  test("the records page's plan link is a real link", async ({ page }) => {
    // Was a styled div with cursor-pointer and no handler.
    await page.goto("/records", { waitUntil: "networkidle" });
    const link = page.locator('a[href="/plans"]').filter({ hasText: /2k prep/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/plans/);
  });
});

test.describe("plan recommendations", () => {
  const PREFS_KEY = "paddleiq.preferences.v1";

  async function setPreferences(page: Page, prefs: object) {
    // Visit first so localStorage is on the right origin, then reload.
    await page.goto("/plans");
    await page.evaluate(
      ([k, v]) => localStorage.setItem(k as string, v as string),
      [PREFS_KEY, JSON.stringify(prefs)] as const,
    );
    await page.goto("/plans", { waitUntil: "networkidle" });
  }

  test("puts the sprint plan first for a sprinter", async ({ page }) => {
    // Regression: all eight plans were listed in one fixed order for everyone,
    // so a beginner who only ergs saw a 200m peaking block first.
    await setPreferences(page, {
      role: "competitive", trainingEnv: ["team_boat", "erg"],
      goals: ["race"], preferredDistances: [200, 250],
    });

    const first = page.locator("button").filter({ hasText: /weeks/ }).first();
    await expect(first).toContainText("200m Sprint Plan");
    await expect(first).toContainText("Best match for you");
  });

  test("puts the foundation plan first for a beginner", async ({ page }) => {
    await setPreferences(page, {
      role: "beginner", trainingEnv: ["team_boat"],
      goals: ["technique", "fitness"], preferredDistances: [],
    });

    const first = page.locator("button").filter({ hasText: /weeks/ }).first();
    await expect(first).toContainText("Dragon Boat Foundation");
  });

  test("explains the recommendation in the athlete's own answers", async ({ page }) => {
    await setPreferences(page, {
      role: "competitive", trainingEnv: ["erg"],
      goals: ["erg_score"], preferredDistances: [2000],
    });

    const first = page.locator("button").filter({ hasText: /weeks/ }).first();
    await expect(first).toContainText("Erg Improvement");
    await expect(first).toContainText(/You race 2km/);
    await expect(first).toContainText(/Works on better erg score/i);
  });

  test("claims nothing personalised when it knows nothing", async ({ page }) => {
    // Better an honest list than a fake recommendation.
    await page.goto("/plans", { waitUntil: "networkidle" });
    await expect(page.getByText("Structured plans for every goal.")).toBeVisible();
    await expect(page.getByText("Best match for you")).toHaveCount(0);
  });

  test("still lists every plan, not just the matching ones", async ({ page }) => {
    await setPreferences(page, {
      role: "competitive", trainingEnv: ["erg"],
      goals: ["erg_score"], preferredDistances: [2000],
    });
    await expect(page.locator("button").filter({ hasText: /weeks/ })).toHaveCount(8);
  });

  test("the custom-plan prompt is a real link", async ({ page }) => {
    // Was a button with no handler.
    await page.goto("/plans", { waitUntil: "networkidle" });
    const link = page.locator('a[href="/ai-coach"]').filter({ hasText: /ask ai coach/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/ai-coach/);
  });
});

test.describe("plan progress", () => {
  test("shows the week you are actually in, not always week 1", async ({ page }) => {
    // Regression: the banner rendered a hardcoded 15% and "Week 1" for every
    // athlete, including one four weeks into a plan.
    await page.goto("/plans");
    await page.evaluate(() => {
      const start = new Date();
      start.setDate(start.getDate() - 21); // three weeks ago → week 4
      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      localStorage.setItem("paddleiq:activePlanId", "plan-500m");
      localStorage.setItem("paddleiq:activePlanStartedAt", iso);
    });
    await page.goto("/plans", { waitUntil: "networkidle" });

    const banner = page.getByText(/Week \d+ of \d+ · \d+% complete/);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Week 4 of 6");
    // 21 of 42 days.
    await expect(banner).toContainText("50% complete");
  });

  test("opens the active plan on the current week", async ({ page }) => {
    await page.goto("/plans");
    await page.evaluate(() => {
      const start = new Date();
      start.setDate(start.getDate() - 14);
      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      localStorage.setItem("paddleiq:activePlanId", "plan-500m");
      localStorage.setItem("paddleiq:activePlanStartedAt", iso);
    });
    await page.goto("/plans", { waitUntil: "networkidle" });

    await page.locator("button").filter({ hasText: /500m Race Prep/ }).first().click();
    // Two weeks in, so week 3 — not the week 1 the page always used to show.
    await expect(page.getByText(/Week 3/).first()).toBeVisible();
  });

  test("starts a newly chosen plan at week 1", async ({ page }) => {
    await page.goto("/plans", { waitUntil: "networkidle" });
    await page.locator("button").filter({ hasText: /Erg Improvement/ }).first().click();
    await expect(page.getByText(/Week 1/).first()).toBeVisible();
  });
});

test.describe("sample data gives way to real data", () => {
  /** Logs one erg session and lands back on the dashboard. */
  async function logAnErgSession(page: Page, metres: string) {
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill(metres);
    await page.locator('input[type="number"]').nth(1).fill("5");
    await page.locator('input[type="number"]').nth(2).fill("0");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
  }

  test("shows sample data to a visitor who has logged nothing", async ({ page }) => {
    // The placeholder is fine — it's what makes the app legible to someone
    // who has just arrived.
    // Asserted on the shape, not on a magic number: the sample figures are
    // derived from the sample sessions now, so hardcoding one here just
    // couples the suite to whatever those happen to add up to today.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const card = page.getByText("km this week").locator("..");
    await expect(card).toContainText(/\d+\.\d/);

    // A visitor should see a populated app, not an empty one.
    await expect(page.getByText(/day streak/i).first()).toBeVisible();
    const streak = await page.getByText(/day streak/i).first().locator("..").innerText();
    expect(Number(streak.match(/(\d+)/)?.[1] ?? 0)).toBeGreaterThan(0);
  });

  test("replaces it the moment a session is logged", async ({ page }) => {
    // Regression: every page returned early on isDemoMode before reading
    // IndexedDB, but sessions save locally regardless of whether Supabase is
    // configured. So an athlete on the deployed site logged a session and then
    // saw 147 sample sessions and someone else's 18.5km week, with their own
    // session on no screen at all.
    await logAnErgSession(page, "1234");
    await page.waitForTimeout(1000);

    // The sample athlete trains far more than one 1.23km session, so a weekly
    // total in single figures is proof the sample data gave way.
    const body = await page.locator("body").innerText();
    expect(body, "the logged session should be here").toContain("1.23");

    const weekly = Number(body.match(/([\d.]+)\s*\n?\s*km this week/)?.[1] ?? 999);
    expect(weekly, "weekly distance should be the athlete's own").toBeLessThan(5);
  });

  test("the coach stops claiming you have no sessions", async ({ page }) => {
    // It returned the "no sessions logged yet" placeholder for anyone in demo
    // mode without ever looking at their data.
    await logAnErgSession(page, "2000");

    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await expect(page.getByText(/No sessions logged yet/i)).toHaveCount(0);
    await expect(page.getByText(/You logged 1 session this week/i)).toBeVisible();
  });

  test("records show the athlete's own, not the sample PRs", async ({ page }) => {
    await logAnErgSession(page, "2000");

    await page.goto("/records", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    // 8:32 is the sample 2k PR; it must not survive alongside real sessions.
    await expect(page.getByText("8:32")).toHaveCount(0);
  });
});

test.describe("feedback on team actions", () => {
  async function openFirstMember(page: Page) {
    await page.goto("/team", { waitUntil: "networkidle" });
    await page.locator("button").filter({ hasText: /Seat 1/ }).first().click();
    await expect(page.getByText("Performance Role")).toBeVisible();
  }

  test("toasts actually render", async ({ page }) => {
    // Regression: sonner was a dependency and eighteen toast() calls were
    // spread across the team pages, but no <Toaster> had ever been mounted.
    // Every confirmation was invisible — and so was every failure, including
    // "Failed to create team. Try again."
    await openFirstMember(page);
    await page.locator("button").filter({ hasText: /^Rocket$/ }).first().click();

    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/role updated/i);
  });

  test("assigning a role does something visible", async ({ page }) => {
    // Regression: in demo mode isCoach is forced true, so every coach control
    // was on screen — and tapping a performance role hit a bare `return`,
    // changing nothing and saying nothing. It read as broken, not unavailable.
    await openFirstMember(page);

    const rocket = page.locator("button").filter({ hasText: /^Rocket$/ }).first();
    await rocket.click();
    await page.waitForTimeout(500);

    // The sheet header shows the assigned role; it should now say Rocket.
    await expect(page.locator("[data-sonner-toast]")).toContainText(/demo mode/i);
    await expect(page.getByText("No performance role assigned")).toHaveCount(0);
  });

  test("the toast sits clear of the bottom navigation", async ({ page }) => {
    // A toast covering the nav would trap someone on the page.
    await openFirstMember(page);
    await page.locator("button").filter({ hasText: /^Technician$/ }).first().click();

    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();

    // Measured in viewport coordinates via getBoundingClientRect. Playwright's
    // boundingBox is document-relative, which mixes scroll position into a
    // comparison between two position:fixed elements and gives a number that
    // means nothing.
    //
    // Polled rather than read once: the toast slides up into place, so a
    // single measurement taken the instant it becomes visible is short by
    // exactly its own height and reports an overlap that isn't there.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const toast = document.querySelector("[data-sonner-toast]");
            const nav = document.querySelector("nav:last-of-type");
            if (!toast || !nav) return null;
            return nav.getBoundingClientRect().top - toast.getBoundingClientRect().bottom;
          }),
        { message: "the toast overlaps the bottom navigation", timeout: 5_000 },
      )
      .toBeGreaterThanOrEqual(0);
  });
});

test.describe("personal records", () => {
  async function logErg(page: Page, metres: number, mins: number, secs: number) {
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill(String(metres));
    await page.locator('input[type="number"]').nth(1).fill(String(mins));
    await page.locator('input[type="number"]').nth(2).fill(String(secs));
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
  }

  test("a timed session sets a record", async ({ page }) => {
    // Regression: db.personalRecords had four readers and no writer, so the
    // whole Records page stayed empty for a real athlete forever.
    await logErg(page, 2000, 8, 32);

    await page.goto("/records", { waitUntil: "networkidle" });
    await expect(page.getByTestId("pr-erg-2000")).toContainText("8:32");
  });

  test("a faster session beats it and says by how much", async ({ page }) => {
    await logErg(page, 2000, 8, 32);
    await logErg(page, 2000, 8, 20);

    await page.goto("/records", { waitUntil: "networkidle" });
    const card = page.getByTestId("pr-erg-2000");
    await expect(card).toContainText("8:20");
    await expect(card).toContainText("Previous: 8:32");
    await expect(card).toContainText(/12s improvement/);
  });

  test("a slower session leaves the record alone", async ({ page }) => {
    await logErg(page, 2000, 8, 20);
    await logErg(page, 2000, 8, 50);

    await page.goto("/records", { waitUntil: "networkidle" });
    await expect(page.getByTestId("pr-erg-2000")).toContainText("8:20");
  });

  test("a non-record distance sets nothing", async ({ page }) => {
    // A 6k steady piece is not a record at anything.
    await logErg(page, 6000, 25, 0);

    await page.goto("/records", { waitUntil: "networkidle" });
    await expect(page.getByTestId("pr-erg-2000")).toContainText("No PR yet");
  });

  test("real records drive the race projections", async ({ page }) => {
    // The predictor was dead for real athletes while nothing created PRs.
    await logErg(page, 2000, 8, 32);
    await logErg(page, 500, 1, 58);

    await page.goto("/records", { waitUntil: "networkidle" });
    await expect(page.getByTestId("pr-erg-1000")).toContainText(/~\d+:\d\d/);
    await expect(page.getByTestId("pr-erg-200")).toContainText("/500m target");
  });
});

test.describe("record notifications", () => {
  async function logErg(page: Page, metres: number, mins: number, secs: number) {
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill(String(metres));
    await page.locator('input[type="number"]').nth(1).fill(String(mins));
    await page.locator('input[type="number"]').nth(2).fill(String(secs));
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
  }

  async function openBell(page: Page) {
    await page.locator('button[aria-label*="Notification"]').first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    return page.getByRole("dialog");
  }

  test("setting a record produces a notification", async ({ page }) => {
    // Regression: the feed drew personal records from the seed in demo mode
    // and from Supabase otherwise, never from Dexie — which is where records
    // are actually written. The most motivating event in the app was the one
    // that never announced itself.
    await logErg(page, 2000, 8, 0);

    const sheet = await openBell(page);
    await expect(sheet).toContainText(/New 2k erg PR/i);
  });

  test("it appears without reloading the app", async ({ page }) => {
    // Regression: the top nav lives in the layout and stays mounted across
    // client-side navigation, so the feed was read once per hard page load.
    // The notification existed but only showed up on the athlete's next visit.
    await logErg(page, 2000, 8, 0);

    // No reload between logging and looking.
    const sheet = await openBell(page);
    await expect(sheet).toContainText(/New 2k erg PR/i);
  });

  test("beating a record says how much faster", async ({ page }) => {
    await logErg(page, 2000, 8, 0);
    await logErg(page, 2000, 7, 45);

    const sheet = await openBell(page);
    await expect(sheet).toContainText(/15\.0s faster than your previous best/);
  });

  test("a session that sets no record announces nothing", async ({ page }) => {
    await logErg(page, 6000, 25, 0);

    const sheet = await openBell(page);
    await expect(sheet).not.toContainText(/PR/);
  });

  test("the unread dot appears for a new record", async ({ page }) => {
    const dot = page.locator('button[aria-label*="Notification"] span.rounded-full');
    await logErg(page, 2000, 8, 0);
    await expect(dot).toHaveCount(1);

    // And clears once looked at.
    await openBell(page);
    await page.getByRole("button", { name: /close notifications/i }).click();
    await expect(dot).toHaveCount(0);
  });
});

test.describe("where your sessions are", () => {
  test("says plainly that sessions live only in this browser", async ({ page }) => {
    // Regression: getQueueHealth and retryFailedItems were written so the app
    // could surface a stuck queue "rather than leaving the athlete to notice
    // their sessions never appear on another device" — and nothing ever
    // called them. There was no way to find out where your data was.
    await page.goto("/profile", { waitUntil: "networkidle" });

    const card = page.getByText("Your Data").locator("..");
    await expect(card).toContainText("Saved on this device");
    await expect(card).toContainText(/aren't backed up to an account/i);
    // It must not read as an error: nothing is wrong, there is just no
    // account. Crying wolf here would train people to ignore the real thing.
    await expect(card).not.toContainText(/failed|error|couldn't be saved/i);
  });

  test("offers no retry when there is nothing to retry", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /try again/i })).toHaveCount(0);
  });

  test("queues nothing when there is no server to sync to", async ({ page }) => {
    // Otherwise the queue grows by two rows per session forever, stamped with
    // the demo user id — a backlog that could only ever be rejected.
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("2000");
    await page.locator('input[type="number"]').nth(1).fill("8");
    await page.locator('input[type="number"]').nth(2).fill("0");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });

    const queued = await page.evaluate(async () => {
      const req = indexedDB.open("paddleiq");
      const db: IDBDatabase = await new Promise((res) => { req.onsuccess = () => res(req.result); });
      if (!db.objectStoreNames.contains("syncQueue")) return 0;
      const store = db.transaction("syncQueue", "readonly").objectStore("syncQueue");
      return new Promise<number>((res) => { const c = store.count(); c.onsuccess = () => res(c.result); });
    });
    expect(queued).toBe(0);

    // The session itself is still there — that's the part that matters.
    await expect(page.getByText(/2\.00km|2\.0 km/).first()).toBeVisible();
  });
});

test.describe("weekly distance goal", () => {
  test("says where the target came from", async ({ page }) => {
    // Regression: the target was a module constant of 20km — the same number
    // for a beginner in their first month and a racer peaking for a 500m, and
    // chosen by nobody. A progress bar against an arbitrary figure tells some
    // athletes they're failing and others they're finished by Tuesday.
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    const card = page.getByText("Weekly Distance Goal").locator("..").locator("..");
    await expect(card).toContainText(/10% above your usual \d+-week volume|A starting target/);
  });

  test("gives a new athlete a starter target, and says so", async ({ page }) => {
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("5000");
    await page.locator('input[type="number"]').nth(1).fill("22");
    await page.locator('input[type="number"]').nth(2).fill("0");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });

    const card = page.getByText("Weekly Distance Goal").locator("..").locator("..");
    await expect(card).toContainText("5.0 / 10 km");
    // One week is a data point, not a pattern — it must not claim otherwise.
    await expect(card).toContainText(/A starting target/);
  });

  test("the target is never the old hardcoded 20", async ({ page }) => {
    // Not a proof of correctness, but this exact string was the bug.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const card = page.getByText("Weekly Distance Goal").locator("..").locator("..");
    await expect(card).not.toContainText("/ 20 km");
  });
});

test.describe("split fade analysis", () => {
  async function logTwoK(page: Page, splits: string[] | null) {
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("2000");
    if (splits) {
      const boxes = page.locator('input[placeholder="1:58"]');
      await expect(boxes).toHaveCount(4);
      for (const [i, v] of splits.entries()) await boxes.nth(i).fill(v);
    }
    await page.locator('input[type="number"]').nth(1).fill("8");
    await page.locator('input[type="number"]').nth(2).fill("16");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
  }

  test("says nothing about fade when no splits were recorded", async ({ page }) => {
    // Regression: the rule invented the four segments from the overall split,
    // so the fade was always exactly 4.0s. Every athlete was told their 2k
    // faded 4.0s in the last 500m — and given pacing advice for it — from a
    // session where they had entered only a total time.
    await logTwoK(page, null);

    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await expect(page.getByText(/split fades/i)).toHaveCount(0);
  });

  test("reports the fade the athlete actually recorded", async ({ page }) => {
    await logTwoK(page, ["1:58", "2:02", "2:05", "2:11"]);

    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    // 1:58 → 2:11 is 13 seconds, and it must say 13, not 4.
    await expect(page.getByText(/2k split fades 13\.0s in the 1500–2000m/).first()).toBeVisible();
  });

  test("a different athlete gets a different number", async ({ page }) => {
    // The number has to depend on the input — that was the whole defect.
    await logTwoK(page, ["1:58", "1:59", "2:00", "2:01"]);

    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await expect(page.getByText(/split fades 3\.0s/).first()).toBeVisible();
    await expect(page.getByText(/split fades 4\.0s/)).toHaveCount(0);
  });

  test("offers the split fields only where they make sense", async ({ page }) => {
    // Intervals total time includes the rests, so per-500 figures wouldn't
    // line up with anything.
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("6000");
    await expect(page.getByText("500m Splits (optional)")).toHaveCount(0);

    await page.locator('input[type="number"]').first().fill("2000");
    await expect(page.getByText("500m Splits (optional)")).toBeVisible();
  });
});

test.describe("signing up when there are no accounts", () => {
  test("says plainly that no account is created", async ({ page }) => {
    // Regression: /login carried a demo-mode notice and /signup didn't. So a
    // visitor filled in a name, email and password under "Create your athlete
    // profile", was sent to onboarding, and had every reason to think they
    // had an account — when nothing was created and their training would live
    // in this browser alone.
    await page.goto("/signup", { waitUntil: "networkidle" });

    await expect(page.getByText(/No accounts yet/i)).toBeVisible();
    await expect(page.getByText(/won't follow you to another device/i)).toBeVisible();
  });

  test("the button doesn't promise an account either", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /continue without an account/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^create account$/i })).toHaveCount(0);
  });

  test("doesn't ask for a password it throws away", async ({ page }) => {
    // Asking for one and discarding it teaches people it protects something.
    await page.goto("/signup", { waitUntil: "networkidle" });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("still lets you through to the app", async ({ page }) => {
    // The demo has to stay usable — this is the front door of the live site.
    await page.goto("/signup", { waitUntil: "networkidle" });
    await page.locator("input").first().fill("Test Athlete");
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.getByRole("button", { name: /continue without an account/i }).click();
    await page.waitForURL(/onboarding|dashboard/, { timeout: 15_000 });
  });
});

test.describe("analytics reports real numbers", () => {
  test("the training mix shows the actual split by modality", async ({ page }) => {
    // Regression: this card had four bars, and "Erg Volume" and "Weekly Goal"
    // were the identical expression — weekly_distance_m / 20000 — rendered
    // twice under different names. "Erg Volume" counted every modality, and
    // the other two divided by an invented 5 and 7.
    await page.goto("/analytics", { waitUntil: "networkidle" });

    const card = page.getByText("Weekly Training Mix").locator("..").locator("..");
    for (const label of ["Erg", "Water", "Team", "Dryland"]) {
      await expect(card).toContainText(label);
    }
    await expect(card).toContainText(/\d+ sessions? · \d+%/);
    // The bars that measured nothing must be gone.
    await expect(card).not.toContainText("Streak Momentum");
    await expect(card).not.toContainText("Sessions / Goal");
    await expect(card).not.toContainText("Erg Volume");
  });

  test("shows a modality with nothing logged rather than hiding it", async ({ page }) => {
    // The gap is the most useful thing on the chart.
    await page.goto("/analytics", { waitUntil: "networkidle" });
    const card = page.getByText("Weekly Training Mix").locator("..").locator("..");
    await expect(card).toContainText(/Dryland\s*0 sessions/);
  });

  test("agrees with the dashboard about the weekly goal", async ({ page }) => {
    // Analytics had its own hardcoded 20km, so the two screens could report
    // different goals for the same athlete on the same day.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const onDashboard = (await page.getByText(/\d+\.\d \/ [\d.]+ km/).first().innerText()).trim();

    await page.goto("/analytics", { waitUntil: "networkidle" });
    const onAnalytics = (await page.getByText(/\d+\.\d \/ [\d.]+ km/).first().innerText()).trim();

    expect(onAnalytics).toBe(onDashboard);
  });

  test("reports effort on the same scale as the rest of the app", async ({ page }) => {
    // Was "8/10" while every other screen uses the five-level picker.
    await page.goto("/analytics", { waitUntil: "networkidle" });
    const log = page.getByText("Erg Session Log").locator("..").locator("..");
    await expect(log).toContainText(/Easy|Moderate|Hard|Very hard|Max/);
    await expect(log).not.toContainText(/\d+\/10/);
  });
});

test.describe("the coach doesn't repeat itself", () => {
  test("this week's focus isn't listed again below", async ({ page }) => {
    // Regression: focusThisWeek was the top warning rendered a second time,
    // so the same sentence appeared under "Focus this week" and immediately
    // again under "Watch out".
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("2000");
    await page.locator('input[type="number"]').nth(1).fill("8");
    await page.locator('input[type="number"]').nth(2).fill("0");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });

    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const lines = (await page.locator("body").innerText())
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const headingAt = lines.findIndex((l) => /^focus this week$/i.test(l));
    expect(headingAt, "the focus heading should be on the page").toBeGreaterThan(-1);

    const headline = lines[headingAt + 1];
    expect(headline, "there should be a focus line").toBeTruthy();

    const occurrences = lines.filter((l) => l === headline).length;
    expect(occurrences, `"${headline}" appears ${occurrences} times`).toBe(1);
  });

  test("doesn't tell a brand-new athlete they have a training gap", async ({ page }) => {
    // Regression: with no dryland sessions the rule reported a 999-day gap,
    // and the engine made it the focus of a beginner's first week.
    await page.goto("/train/erg", { waitUntil: "networkidle" });
    await page.locator('input[type="number"]').first().fill("2000");
    await page.locator('input[type="number"]').nth(1).fill("8");
    await page.locator('input[type="number"]').nth(2).fill("0");
    await page.getByRole("button", { name: /save erg session/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15_000 });

    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await expect(page.getByText(/No dryland sessions logged yet/i)).toHaveCount(0);
  });
});

test.describe("technique video", () => {
  test("doesn't load YouTube until you ask it to", async ({ page }) => {
    // The embed pulls in several hundred KB of player and sets third-party
    // cookies on load. Neither should happen to someone who never pressed
    // play — and an iframe loading on mount would fail on every page view for
    // an athlete at a boathouse with no signal.
    const thirdParty: string[] = [];
    page.on("request", (r) => {
      const host = new URL(r.url()).host;
      if (!/localhost|127\.0\.0\.1/.test(host)) thirdParty.push(host);
    });

    await page.goto("/technique", { waitUntil: "networkidle" });

    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /play video/i })).toBeVisible();
    expect(thirdParty.filter((h) => /youtube|google|ggpht/.test(h))).toEqual([]);
  });

  test("loads the player once you press play", async ({ page }) => {
    await page.goto("/technique", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /play video/i }).click();

    const frame = page.locator("iframe").first();
    await expect(frame).toBeVisible();
    // nocookie host, so nothing is set for someone who watches once.
    expect(await frame.getAttribute("src")).toContain("youtube-nocookie.com");
  });

  test("credits the channel and links to it", async ({ page }) => {
    // It's someone else's work.
    await page.goto("/technique", { waitUntil: "networkidle" });
    const credit = page.locator('a[href*="@PaddlesUpDB"]');
    await expect(credit).toBeVisible();
    await expect(credit).toHaveAttribute("rel", /noopener/);
  });

  test("explains itself offline instead of showing a broken frame", async ({ page, context }) => {
    await page.goto("/technique", { waitUntil: "networkidle" });
    // Toggled while the page is open rather than reloaded: reloading offline
    // correctly serves the app's /offline fallback, which is a different
    // behaviour from the one under test here.
    await context.setOffline(true);
    try {
      await expect(page.getByText(/needs a connection/i)).toBeVisible();
      // And the part that does work offline is still offered.
      await expect(page.getByText(/written cues, mistakes and drills/i)).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe("the coach on sample data", () => {
  test("gives a visitor real insights, not an empty state", async ({ page }) => {
    // Regression: every other screen falls back to the sample data for a
    // visitor — the dashboard's 147 sessions, the sample records, the charts.
    // The coach was the one page that didn't, so someone exploring a fully
    // populated app arrived here and was told "no sessions logged yet". That
    // reads as the coach being broken, and is how it was reported.
    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await expect(page.getByText(/No sessions logged yet/i)).toHaveCount(0);
    await expect(page.getByText(/You logged \d+ sessions? this week/i)).toBeVisible();
  });

  test("the sample athlete has trained recently", async ({ page }) => {
    // Regression: the seed dates were fixed strings, newest 3 June 2026. By
    // late August the demo showed someone who hadn't trained in twelve weeks
    // — invisible on screens whose figures come from hardcoded mockStats, and
    // glaring on the coach, which computes from the dates.
    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await expect(page.getByText(/No sessions logged this week yet/i)).toHaveCount(0);
    await expect(page.getByText(/day training streak/i)).toBeVisible();
  });

  test("never claims a record was beaten by 0.0s", async ({ page }) => {
    // A PR is created from a session, so that session's time equals the PR
    // exactly and the gap is zero — which rendered as "New 500m PR! Beat old
    // best by 0.0s", three times over on the sample data.
    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await expect(page.getByText(/beat old best by 0\.0s/i)).toHaveCount(0);
  });

  test("a question opens an answer drawn from the data", async ({ page }) => {
    await page.goto("/ai-coach", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await page.locator("button").filter({ hasText: /Which distance am I improving/ }).first().click();
    const panel = page.locator("body");
    await expect(panel).toContainText(/2k|1k|500m|log/i);
  });
});
