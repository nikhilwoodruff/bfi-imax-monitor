import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/bfi-imax-monitor",
  images: { unoptimized: true },
};

export default nextConfig;
