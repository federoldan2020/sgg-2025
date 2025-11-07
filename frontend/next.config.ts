import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // para PM2/VPS
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },
  eslint: { ignoreDuringBuilds: true },
  httpAgentOptions: { keepAlive: true },
  images: { remotePatterns: [] },
};

export default nextConfig;
