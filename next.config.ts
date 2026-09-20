import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack emits source maps for the server bundle by default, even
    // though productionBrowserSourceMaps (client maps) is already off. These
    // are never served to a browser and Next does not read them back to
    // symbolicate a production stack trace, so they exist purely as build
    // artifact weight: ~89MB across ~400 files in a project this size. That
    // was the second contributor, alongside .next/cache, to a deployment
    // artifact exceeding AWS Amplify's 230MB limit.
    turbopackSourceMaps: false,
  },
};

export default nextConfig;
