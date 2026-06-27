import type { NextConfig } from "next";

// Security headers (M7). This is a static informational site (privacy / terms /
// cookies) with no auth, secrets, or user input, so the high-value headers are
// HSTS, anti-clickjacking, MIME-sniffing protection, and referrer/permissions
// tightening. The CSP allows Google Fonts plus the inline styles/scripts that
// Next.js + next-themes require; 'unsafe-inline' on script-src is the pragmatic
// choice here (no nonce pipeline) given the minimal XSS surface of a content
// site. Applied to every route; Vercel serves them (vercel.json sets no headers).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
