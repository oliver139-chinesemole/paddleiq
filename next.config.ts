import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip TS type-checking and ESLint during CI build to stay within Render free-tier memory.
  // Both are verified locally and in GitHub Actions before merge.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Standalone output reduces deployed artifact size.
  output: "standalone",
};

export default nextConfig;
