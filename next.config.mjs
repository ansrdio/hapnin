import createMDX from "@next/mdx";

// ── Security response headers ────────────────────────────────────────────────
// Applied to every route. The Content-Security-Policy ships in REPORT-ONLY
// mode first: nothing is blocked, violations are POSTed to /api/csp-report and
// land in the function logs (and Sentry when configured). Once a full
// click-through (checkout with Apple Pay, event page with a map, scanner,
// login) produces no reports, rename the header to Content-Security-Policy.
//
// Allowlist, by who needs it:
//   Stripe.js + Express Checkout  js.stripe.com, hooks.stripe.com, api.stripe.com, *.stripe.com images
//   Map on the event page         cdnjs (MapLibre script + css), tiles.openfreemap.org (style/tiles/glyphs), blob: workers
//   Firebase Auth (email link)    identitytoolkit / securetoken / www.googleapis.com, the auth domain
//   Flyers                        firebasestorage.googleapis.com
//   Google Wallet save            pay.google.com (navigation, but allowed as a frame just in case)
// Next.js needs 'unsafe-inline' for its hydration scripts (no nonce without middleware).
// Fonts are self-hosted, so font-src stays 'self' + data:.

const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}` : "";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.stripe.com https://tiles.openfreemap.org",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://api.stripe.com https://q.stripe.com https://r.stripe.com https://m.stripe.network https://errors.stripe.com",
    "https://tiles.openfreemap.org",
    "https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
    "https://firebasestorage.googleapis.com",
    authDomain,
  ]
    .filter(Boolean)
    .join(" "),
  "frame-src https://js.stripe.com https://hooks.stripe.com https://pay.google.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Add "upgrade-insecure-requests" when switching to enforcement; browsers
  // ignore it (and log a console error) in report-only mode.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  // Two years, all subdomains. Add "; preload" and submit to hstspreload.org
  // only once you're sure every subdomain will always be HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera: the door scanner. Payment: Apple Pay / Google Pay inside Stripe's frame.
  {
    key: "Permissions-Policy",
    value: 'camera=(self), payment=(self "https://js.stripe.com" "https://hooks.stripe.com"), microphone=(), geolocation=(), usb=(), interest-cohort=()',
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Dev builds use eval'd source maps that the policy would flag on every load.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy-Report-Only", value: csp }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // firebase-admin uses gRPC/native + dynamic requires that Next's bundler
  // breaks. Keep it external so it's required at runtime on Vercel's Node.
  serverExternalPackages: ["firebase-admin"],
  // The OG-image / favicon routes read .ttf files from assets/fonts at runtime
  // via process.cwd(). That path isn't statically analyzable, so Vercel's file
  // tracing can miss it and the routes 500 in production. Pin the fonts into
  // each route's serverless bundle.
  outputFileTracingIncludes: {
    "/icon": ["./assets/fonts/**"],
    "/apple-icon": ["./assets/fonts/**"],
    "/opengraph-image": ["./assets/fonts/**"],
    "/pitch/opengraph-image": ["./assets/fonts/**"],
    "/why/opengraph-image": ["./assets/fonts/**"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
