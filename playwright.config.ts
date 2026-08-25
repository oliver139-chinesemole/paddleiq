import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a production build, because that's where the bugs
// this suite is meant to catch actually appear — a missing Suspense boundary
// or a prerender failure passes fine in dev and breaks `next build`.

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Every assertion here should be deterministic; a retry would just hide flake.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // The app is mobile-first, so test it at the size it's designed for.
    ...devices["Pixel 7"],
  },

  webServer: {
    command: `npx next start --port ${PORT}`,
    url: BASE_URL,
    // Locally, reuse whatever is already running instead of fighting for the port.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
