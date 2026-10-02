import type { NextConfig } from "next";

const securityHeaders = [
  // The payment page must never be framed by another site (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak which invoice page a visitor came from.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Optional deps pulled in by the Coinbase/Base wallet SDK that we never use.
const unusedOptionalDeps = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: Object.fromEntries(unusedOptionalDeps.map((m) => [m, "./lib/empty-module.js"])),
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
