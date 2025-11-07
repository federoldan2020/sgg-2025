import type { NextConfig } from "next";
const isProd = process.env.NODE_ENV === "production";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ejecutable standalone para VPS/PM2
  output: "standalone",

  // Evita el minificador CSS nativo (causa del error en CI)
  experimental: { optimizeCss: false },

  poweredByHeader: false,
  compress: true,

  compiler: {
    // Remueve console.* en prod (excepto warn/error)
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },

  eslint: { ignoreDuringBuilds: true },

  httpAgentOptions: { keepAlive: true },

  images: {
    // Ajustá si usás imágenes remotas
    remotePatterns: [],
  },
};

export default nextConfig;
