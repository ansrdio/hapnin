"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary: catches errors thrown by the root layout itself, where
// app/error.tsx can't render. Reports to Sentry and shows a plain recovery
// screen (this replaces <html>, so it can't use the site chrome or fonts).

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#15101B", color: "#F2EAE0", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong.</h1>
          <p style={{ color: "#B3A5BC", lineHeight: 1.6, margin: "0 0 24px" }}>
            We&rsquo;ve been notified. Try again, and if it keeps happening email{" "}
            <a href="mailto:jii@hapnin.now" style={{ color: "#D9A84A" }}>jii@hapnin.now</a>
            {error.digest ? <> and mention code {error.digest}</> : null}.
          </p>
          <button
            onClick={reset}
            style={{ background: "#D9A84A", color: "#15101B", border: 0, borderRadius: 12, padding: "12px 24px", fontWeight: 600, fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
