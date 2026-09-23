// Sentry in the browser: unhandled exceptions and failed React renders on the
// checkout, scanner and dashboard. No session replay (it would record buyer
// details), no PII, low trace sampling. Events go through the same-origin
// /monitoring tunnel (see next.config.mjs) so the CSP allowlist and ad
// blockers don't get in the way. Off until NEXT_PUBLIC_SENTRY_DSN is set.

import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./lib/monitoring";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    ignoreErrors: [
      // Browser noise, not Hapnin bugs.
      "ResizeObserver loop",
      "Load failed", // Safari's generic fetch abort on navigation
      /^AbortError/,
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
