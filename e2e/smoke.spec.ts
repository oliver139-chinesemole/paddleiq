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
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByText(/18\.5/).first()).toBeVisible();
  });

  test("replaces it the moment a session is logged", async ({ page }) => {
    // Regression: every page returned early on isDemoMode before reading
    // IndexedDB, but sessions save locally regardless of whether Supabase is
    // configured. So an athlete on the deployed site logged a session and then
    // saw 147 sample sessions and someone else's 18.5km week, with their own
    // session on no screen at all.
    await logAnErgSession(page, "1234");
    await page.waitForTimeout(1000);

    const body = await page.locator("body").innerText();
    expect(body, "sample weekly volume should be gone").not.toContain("18.5");
    expect(body, "the logged session should be here").toContain("1.23");
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
