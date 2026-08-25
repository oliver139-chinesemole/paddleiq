import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Revision for the manually-precached /offline entry. Serwist re-fetches an
// entry when its revision changes, so this has to move whenever the page might
// have. Render exposes the commit; falling back to build time is safe because
// it only means re-fetching one small page per build.
const BUILD_REVISION =
  process.env.RENDER_GIT_COMMIT ?? process.env.GITHUB_SHA ?? String(Date.now());

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable SW in development to avoid stale-cache issues during hot reload
  disable: process.env.NODE_ENV === "development",

  // globPublicPatterns defaults to ["**/*"], which swept the whole of public/
  // into the precache — including ~48MB of MediaPipe models and wasm. That was
  // downloaded eagerly by every visitor on first load, whether or not they ever
  // opened Form Check. Those assets are fetched on demand instead, and the
  // browser's HTTP cache keeps them after the first use.
  globPublicPatterns: ["**/*", "!mediapipe/**"],

  // Off by default, so no page an athlete visited was ever cached and the app
  // could not load at all without a network — despite shipping an /offline
  // page and an offline-first sync queue.
  cacheOnNavigation: true,

  // The document fallback in app/sw.ts points at /offline, but App Router
  // routes aren't in the generated manifest, so there was nothing to fall back
  // to. Precaching it explicitly is what makes that fallback resolve.
  additionalPrecacheEntries: [{ url: "/offline", revision: BUILD_REVISION }],
});

const nextConfig: NextConfig = {
  // Skip type-checking during the build so it fits Render's free-tier memory.
  // Types are enforced by the dedicated `typecheck` step in .github/workflows/
  // ci.yml — without that step this flag would let type errors reach prod.
  typescript: { ignoreBuildErrors: true },
  // Empty turbopack config silences the "webpack config without turbopack" warning
  // in Next.js 16 dev mode. Serwist still uses webpack for the production build
  // (via `next build --webpack`), which is what Render runs.
  turbopack: {},
};

export default withSerwist(nextConfig);
