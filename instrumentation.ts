// Next.js instrumentation hook: loads the right Sentry config for the runtime
// and forwards unhandled errors from route handlers, server actions and
// server components (the ones Next would otherwise only print to the logs).

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
