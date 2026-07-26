import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/bfi-imax-monitor",
  images: { unoptimized: true },
  // The homepage fetches every screening's CSV at build time; the default
  // 60s static generation timeout is too tight for ~500 files
  staticPageGenerationTimeout: 300,
};

export default nextConfig;
