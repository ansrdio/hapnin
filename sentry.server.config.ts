// Sentry on the Node runtime (route handlers, server actions, server components).
// Loaded by instrumentation.ts. Off entirely until NEXT_PUBLIC_SENTRY_DSN is set,
// so local dev and previews without a DSN behave exactly as before.
//
// Every existing console.error / console.warn becomes a Sentry event via the
// console integration — the ~60 call sites in checkout, webhook, refunds and
// organizer actions are the incident signal, no refactor needed. Personal
// data is scrubbed before anything leaves the box (see lib/monitoring).

import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./lib/monitoring";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
    beforeSend: scrubEvent,
    ignoreErrors: [
      // Next.js control flow, not failures.
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],
  });
}
