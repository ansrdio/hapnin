"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { signupOrganizerAction } from "./actions";
import { initialActionState } from "@/app/admin/action-state";

const field =
  "w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-xl bg-gold px-6 py-4 font-display text-lg font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
    >
      {pending ? "Setting you up…" : "Create my host account"}
    </button>
  );
}

export function HostSignupForm({ src = null, code = null }: { src?: string | null; code?: string | null }) {
  const [state, action] = useActionState(signupOrganizerAction, initialActionState);
  const [email, setEmail] = useState("");
  const [showCode, setShowCode] = useState(!!code);
  const err = state.fieldErrors ?? {};

  // On success, hand off to the tested sign-in flow (prefilled email).
  useEffect(() => {
    if (state.status === "success") {
      window.location.href = `/login?next=/o&email=${encodeURIComponent(email)}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={action} noValidate className="space-y-5">
      {src && <input type="hidden" name="src" value={src} />}
      <div>
        <label className={label}>Name or crew</label>
        <input name="name" className={field} placeholder="AuraCollective" />
        {err.name && <p className="mt-1 text-sm text-coral">{err.name}</p>}
      </div>
      <div>
        <label className={label}>Your Hapnin handle</label>
        <div className="flex items-center gap-2">
          <span className="text-mauve-dim">hapnin.now/o/</span>
          <input name="handle" className={field} placeholder="aura" />
        </div>
        {err.handle && <p className="mt-1 text-sm text-coral">{err.handle}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Email (your login)</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            placeholder="you@email.com"
          />
          {err.email && <p className="mt-1 text-sm text-coral">{err.email}</p>}
        </div>
        <div>
          <label className={label}>Mobile</label>
          <input name="phone" type="tel" className={field} placeholder="(602) 555-0142" />
          {err.phone && <p className="mt-1 text-sm text-coral">{err.phone}</p>}
        </div>
      </div>
      <div>
        <label className={label}>Instagram (optional)</label>
        <input name="instagram" className={field} placeholder="auracollective" />
        {err.instagram && <p className="mt-1 text-sm text-coral">{err.instagram}</p>}
      </div>

      {showCode ? (
        <div>
          <label className={label}>Launch code</label>
          <input name="code" defaultValue={code ?? ""} className={`${field} uppercase`} placeholder="CODE" autoCapitalize="characters" />
          <p className="mt-1 text-xs text-mauve-dim">From a Hapnin launch night or a referral. Waives our fee for a while.</p>
          {err.code && <p className="mt-1 text-sm text-coral">{err.code}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setShowCode(true)} className="text-sm text-gold underline decoration-gold/40 underline-offset-4 hover:text-gold-hi">
          Have a launch code?
        </button>
      )}

      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}

      <Submit />
      <p className="text-center text-xs text-mauve-dim/80">
        Free to start. You’ll connect Stripe payouts from your dashboard before your first sale.
      </p>
    </form>
  );
}
