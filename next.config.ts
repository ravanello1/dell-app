import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP pragmática: forte onde importa (frames, objetos, origem de conexão) sem
 * quebrar o runtime do Next, que injeta scripts inline de bootstrap.
 * `unsafe-eval` só existe em desenvolvimento (React Refresh depende dele).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // O cliente libSQL carrega bindings nativos quando a URL é um arquivo local.
  // Mantê-lo fora do bundle evita que o Turbopack tente empacotar o binário.
  serverExternalPackages: ["@libsql/client", "libsql"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // O service worker precisa ser sempre revalidado, senão o app fica
        // preso numa versão antiga do cache depois de um deploy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
