/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextConfig } from "next";

/**
 * Next.js configuración “prod-ready”
 * - output: 'standalone' (para PM2 / Docker / VPS)
 * - optimizeCss: false (evita binario nativo de lightningcss en CI)
 * - hardening de headers y minificación SWC
 * - removeConsole en producción (excepto warn/error)
 * - soporte para bundle analyzer opcional por env
 */
const isProd = process.env.NODE_ENV === "production";
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? (config: NextConfig) => ({
        ...config,
        // Puedes usar `next build && ANALYZE=true` para ver el bundle
        webpack: (webpackConfig: any, ctx: any) => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
          webpackConfig.plugins.push(new BundleAnalyzerPlugin());
          return typeof config.webpack === "function"
            ? config.webpack(webpackConfig, ctx)
            : webpackConfig;
        },
      })
    : (config: NextConfig) => config;

const baseConfig: NextConfig = {
  // App Router OK (Next 15)
  reactStrictMode: true,
  swcMinify: true,

  // Para correr con PM2 sin dependencias del sistema
  output: "standalone",

  // Desactivar lightningcss para evitar error en CI/runner
  experimental: {
    optimizeCss: false,
  },

  // Endurecimiento básico
  poweredByHeader: false, // oculta 'X-Powered-By: Next.js'
  compress: true, // gzip en Node (igual Nginx también comprime)

  // Opcional: remover console.* en prod (excepto warn/error)
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },

  // Ignorar ESLint en build (CI se encarga en otro job si querés)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Si algún día lo necesitás (no recomendado), podés ignorar errores TS en build
  // typescript: { ignoreBuildErrors: true },

  // HTTP keep-alive para fetch interno (mejor perf)
  httpAgentOptions: {
    keepAlive: true,
  },

  // Si cargás imágenes externas, setea dominios/remotes acá
  images: {
    // domains: ["tu-cdn.com"],
    remotePatterns: [
      // { protocol: "https", hostname: "…", pathname: "/**" },
    ],
  },

  // Redirecciones/rewrites si luego necesitás
  // async redirects() { return []; },
  // async rewrites() { return []; },
};

export default withBundleAnalyzer(baseConfig);
