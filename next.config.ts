import type { NextConfig } from "next";

// Security headers (M7). Beyond the legal/marketing pages this now serves
// public property browse (server-rendered) and a landlord listing flow that
// signs in with the Firebase Web SDK, so the CSP has to admit Firebase Auth +
// Firestore and Cloudinary uploads on connect-src. The high-value headers are
// HSTS, anti-clickjacking, MIME-sniffing protection, and referrer/permissions
// tightening. The CSP allows Google Fonts plus the inline styles/scripts that
// Next.js + next-themes require; 'unsafe-inline' on script-src is the pragmatic
// choice here (no nonce pipeline). Applied to every route; Vercel serves them
// (vercel.json sets no headers).
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
      // www.google.com + gstatic are reCAPTCHA, which Firebase phone auth
      // requires on web (RecaptchaVerifier). Unlike App Check, this one is not
      // optional — sign-in silently fails without it.
      "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
      "frame-src https://www.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "media-src 'self' https://res.cloudinary.com",
      [
        "connect-src 'self'",
        // The Firebase SDKs fan out across a number of *.googleapis.com hosts:
        // identitytoolkit + securetoken (auth), firestore, firebasestorage
        // (verification documents), firebaseappcheck AND
        // content-firebaseappcheck (App Check exchanges tokens on the latter).
        // Listing them individually kept breaking as new ones appeared — each
        // failure being a silent CSP block that surfaced as a confusing 401
        // from an App Check gated callable. Scoped to Google's API domain over
        // TLS, which is a deliberate trade of a little precision for not
        // shipping features that mysteriously fail.
        "https://*.googleapis.com",
        // reCAPTCHA Enterprise's own traffic.
        "https://www.google.com",
        // Callable Cloud Functions (submitNin, resolveAccount, recordRentPayment, …).
        "https://us-central1-clearrent-app.cloudfunctions.net",
        // Property photos upload to the same Cloudinary cloud and unsigned
        // preset the Flutter app uses, so both surfaces produce identical URLs.
        "https://api.cloudinary.com",
      ].join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // No remotePatterns for Cloudinary: property photos use a per-<Image> custom
  // loader (lib/cloudinary-loader.ts) that requests a resized image from the
  // CDN directly, so nothing is proxied through /_next/image.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
