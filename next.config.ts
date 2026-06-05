import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable SW in development to avoid stale-cache issues during hot reload
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Skip TypeScript type-checking during CI build (Render free tier memory).
  // Types are verified locally and in GitHub Actions.
  typescript: { ignoreBuildErrors: true },
};

export default withSerwist(nextConfig);
