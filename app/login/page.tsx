import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginClient } from "./LoginClient";
import { Wordmark } from "@/app/components/Brand";

export const metadata: Metadata = {
  title: "Sign in — Hapnin",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="grain flex min-h-[100svh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <a href="/" aria-label="Hapnin home" className="mb-6 inline-block text-cream">
          <Wordmark height={26} />
        </a>
        <Suspense fallback={<p className="text-mauve-dim">Loading…</p>}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}
