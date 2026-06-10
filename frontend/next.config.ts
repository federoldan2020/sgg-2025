import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** URL del NestJS para rewrites en dev (evita CORS en el navegador). */
const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

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
  // En desarrollo: /api/* → backend (misma origin que Next, sin preflight CORS)
  async rewrites() {
    if (isProd) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
