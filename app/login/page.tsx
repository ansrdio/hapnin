import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in — Hapnin",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <p className="mb-6 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.28em] text-gold">
          <span className="inline-block h-2 w-2 rotate-45 bg-coral" aria-hidden="true" />
          Hapnin
        </p>
        <Suspense fallback={<p className="text-mauve-dim">Loading…</p>}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}
