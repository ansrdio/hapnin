"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

const EMAIL_KEY = "hapnin_signin_email";

export function LoginClient() {
  const params = useSearchParams();
  const next = params.get("next") || "";
  const denied = params.get("denied");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "completing" | "error">(
    denied ? "error" : "idle"
  );
  const [message, setMessage] = useState(
    denied ? "That account isn’t set up for this area." : ""
  );

  // If we arrived via the email link, finish the sign-in.
  useEffect(() => {
    const auth = getClientAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    (async () => {
      setStatus("completing");
      let saved = window.localStorage.getItem(EMAIL_KEY);
      if (!saved) saved = window.prompt("Confirm your email to finish signing in") || "";
      if (!saved) {
        setStatus("error");
        setMessage("We need your email to finish signing in.");
        return;
      }
      try {
        const cred = await signInWithEmailLink(auth, saved, window.location.href);
        const idToken = await cred.user.getIdToken();
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(
            data.error === "not_authorized"
              ? "This email isn’t set up yet. Ask your admin to add you."
              : "Sign-in failed. Try requesting a new link."
          );
          return;
        }
        window.localStorage.removeItem(EMAIL_KEY);
        window.location.href = next || (data.role === "admin" ? "/admin" : "/o");
      } catch {
        setStatus("error");
        setMessage("That link is invalid or has expired. Request a new one.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    try {
      const auth = getClientAuth();
      const url = `${window.location.origin}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
      window.localStorage.setItem(EMAIL_KEY, email);
      setStatus("sent");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message || "Couldn’t send the link.");
    }
  }

  if (status === "completing") {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold text-cream">Signing you in…</h1>
        <p className="mt-2 text-mauve-dim">One moment.</p>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div role="status">
        <h1 className="font-display text-2xl font-semibold text-cream">Check your email.</h1>
        <p className="mt-2 leading-relaxed text-mauve-dim">
          We sent a sign-in link to <span className="text-cream">{email}</span>. Open it on this
          device to finish.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-cream">Sign in</h1>
      <p className="mt-2 text-mauve-dim">We’ll email you a one-time link — no password.</p>
      <form onSubmit={send} className="mt-6">
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-gold px-6 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi"
        >
          Send me a link
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-coral">{message}</p>}
    </div>
  );
}
