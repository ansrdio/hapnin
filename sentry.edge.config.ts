// Sentry for the Edge runtime. Hapnin has no middleware or edge routes today;
// this exists so the SDK's instrumentation hook has something to load if one
// is ever added. Same DSN gate as the server config.

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
    beforeSend: scrubEvent,
  });
}
