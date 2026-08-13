"use client";

import { useMemo, useState } from "react";
import type { Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe-client";

type Tier = { id: string; name: string; price_cents: number; remaining: number };
type Amounts = { subtotal_cents: number; card_fee_cents: number; total_cents: number };

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const field =
  "w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold";

const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#F4B24C",
    colorBackground: "#2C1342",
    colorText: "#F6EEE1",
    colorDanger: "#F2593F",
    borderRadius: "12px",
    fontFamily: "system-ui, sans-serif",
  },
};

export function CheckoutClient({
  slug,
  eventTitle,
  consentText,
  tiers,
  promoterCode,
}: {
  slug: string;
  eventTitle: string;
  consentText: string;
  tiers: Tier[];
  promoterCode?: string | null;
}) {
  const [tierId, setTierId] = useState(tiers[0].id);
  const [qty, setQty] = useState(1);
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", zip: "" });
  const [screening, setScreening] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Amounts | null>(null);

  const tier = tiers.find((t) => t.id === tierId)!;
  const maxQ = Math.min(8, tier.remaining);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tierId, quantity: qty, ...f, screening, optIn, p: promoterCode ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(
          data.fieldErrors ?? {
            form:
              data.error === "sold_out"
                ? "That just sold out — pick another tier."
                : "Something went wrong. Try again.",
          }
        );
        return;
      }
      setAmounts(data.amounts);
      setClientSecret(data.clientSecret);
    } finally {
      setBusy(false);
    }
  }

  const options = useMemo(
    () => (clientSecret ? { clientSecret, appearance } : undefined),
    [clientSecret]
  );

  if (clientSecret && options && amounts) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <h1 className="font-display text-2xl font-semibold text-cream">Pay</h1>
        <p className="mt-1 text-mauve-dim">{eventTitle}</p>
        <Elements stripe={getStripeClient()} options={options}>
          <PayStep slug={slug} total={amounts.total_cents} />
        </Elements>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="font-display text-3xl font-bold text-cream">Get tickets</h1>
      <p className="mt-1 text-mauve-dim">{eventTitle}</p>

      <form onSubmit={submitDetails} noValidate className="mt-8 space-y-5">
        {tiers.length > 1 && (
          <div>
            <label className={label}>Ticket</label>
            <select
              value={tierId}
              onChange={(e) => {
                setTierId(e.target.value);
                setQty(1);
              }}
              className={`${field} [color-scheme:dark]`}
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {usd(t.price_cents)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={label}>Quantity</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-11 w-11 rounded-xl border border-plum-hi text-xl text-cream hover:bg-plum"
              aria-label="Decrease"
            >
              −
            </button>
            <span className="font-display text-xl tabular-nums text-cream">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQ, q + 1))}
              className="h-11 w-11 rounded-xl border border-plum-hi text-xl text-cream hover:bg-plum"
              aria-label="Increase"
            >
              +
            </button>
            <span className="ml-auto font-display text-lg tabular-nums text-cream">
              {usd(tier.price_cents * qty)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>First name</label>
            <input className={field} value={f.firstName} onChange={set("firstName")} autoComplete="given-name" />
            {errors.firstName && <p className="mt-1 text-sm text-coral">{errors.firstName}</p>}
          </div>
          <div>
            <label className={label}>Last name</label>
            <input className={field} value={f.lastName} onChange={set("lastName")} autoComplete="family-name" />
            {errors.lastName && <p className="mt-1 text-sm text-coral">{errors.lastName}</p>}
          </div>
        </div>
        <div>
          <label className={label}>Mobile number</label>
          <input className={field} type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="(602) 555-0142" autoComplete="tel" />
          {errors.phone && <p className="mt-1 text-sm text-coral">{errors.phone}</p>}
        </div>
        <div>
          <label className={label}>Email</label>
          <input className={field} type="email" inputMode="email" value={f.email} onChange={set("email")} autoComplete="email" />
          {errors.email && <p className="mt-1 text-sm text-coral">{errors.email}</p>}
        </div>
        <div>
          <label className={label}>ZIP</label>
          <input className={field} inputMode="numeric" value={f.zip} onChange={set("zip")} placeholder="85004" autoComplete="postal-code" />
          <p className="mt-1 text-xs text-mauve-dim">So we can tell you about events near you.</p>
          {errors.zip && <p className="mt-1 text-sm text-coral">{errors.zip}</p>}
        </div>

        <fieldset>
          <legend className={label}>Into Nollywood screenings?</legend>
          <div className="flex gap-2">
            {["yes", "no", "maybe"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setScreening((s) => (s === v ? "" : v))}
                className={`flex-1 rounded-xl border px-3 py-2.5 capitalize ${
                  screening === v ? "border-gold bg-gold/10 text-cream" : "border-plum-hi text-mauve-dim"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-mauve-dim">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-1 accent-gold" />
          <span>{consentText}</span>
        </label>

        {errors.form && <p className="text-sm text-coral">{errors.form}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gold px-6 py-4 font-display text-lg font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
        >
          {busy ? "One sec…" : `Continue — ${usd(tier.price_cents * qty)}`}
        </button>
      </form>
    </main>
  );
}

function PayStep({ slug, total }: { slug: string; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/e/${slug}/confirmation` },
    });
    if (error) {
      setErr(error.message || "Payment failed. Try again.");
      setBusy(false);
    }
    // On success Stripe redirects to the confirmation page.
  }

  return (
    <form onSubmit={pay} className="mt-6 space-y-5">
      <p className="text-sm text-mauve-dim">Card processing is included — the organizer keeps the face value.</p>
      <PaymentElement />
      {err && <p className="text-sm text-coral">{err}</p>}
      <button
        type="submit"
        disabled={busy || !stripe}
        className="w-full rounded-xl bg-gold px-6 py-4 font-display text-lg font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
      >
        {busy ? "Processing…" : `Pay ${usd(total)}`}
      </button>
    </form>
  );
}
