import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip TS type-checking and ESLint at build time on Render free tier.
  // Both are enforced locally and in GitHub Actions CI.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
