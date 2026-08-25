import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable SW in development to avoid stale-cache issues during hot reload
  disable: process.env.NODE_ENV === "development",
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
