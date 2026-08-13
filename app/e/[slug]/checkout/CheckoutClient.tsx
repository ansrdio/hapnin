"use client";

import { useMemo, useState } from "react";
import type { Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe-client";

type Tier = { id: string; name: string; price_cents: number; remaining: number; kind: "ga" | "table"; seats: number | null };
type Amounts = { subtotal_cents: number; discount_cents: number; card_fee_cents: number; total_cents: number };

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
  preselectTierId,
}: {
  slug: string;
  eventTitle: string;
  consentText: string;
  tiers: Tier[];
  promoterCode?: string | null;
  preselectTierId?: string | null;
}) {
  const initialTier = tiers.find((t) => t.id === preselectTierId)?.id ?? tiers[0].id;
  const [tierId, setTierId] = useState(initialTier);
  const [qty, setQty] = useState(1);
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", zip: "" });
  const [screening, setScreening] = useState("");
  const [promo, setPromo] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Amounts | null>(null);

  const tier = tiers.find((t) => t.id === tierId)!;
  const isTable = tier.kind === "table";
  const maxQ = isTable ? 1 : Math.min(8, tier.remaining);
  const effQty = isTable ? 1 : qty;
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
        body: JSON.stringify({ slug, tierId, quantity: effQty, ...f, screening, optIn, p: promoterCode ?? undefined, promo: promo.trim() || undefined }),
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
      <main className="grain mx-auto max-w-md px-5 py-12">
        <h1 className="masthead-shadow anim-rise font-display text-3xl font-bold text-cream">Pay</h1>
        <p className="anim-rise mt-1 text-mauve-dim">{eventTitle}</p>
        <dl className="mt-6 space-y-1.5 text-sm">
          <div className="flex justify-between text-mauve-dim">
            <dt>Tickets</dt>
            <dd className="tabular-nums">{usd(amounts.subtotal_cents + amounts.discount_cents)}</dd>
          </div>
          {amounts.discount_cents > 0 && (
            <div className="flex justify-between text-emerald">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{usd(amounts.discount_cents)}</dd>
            </div>
          )}
          <div className="flex justify-between text-mauve-dim">
            <dt>Card processing</dt>
            <dd className="tabular-nums">{usd(amounts.card_fee_cents)}</dd>
          </div>
          <div className="flex justify-between border-t border-plum-hi pt-1.5 font-semibold text-cream">
            <dt>Total</dt>
            <dd className="tabular-nums">{usd(amounts.total_cents)}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <Elements stripe={getStripeClient()} options={options}>
            <PayStep slug={slug} total={amounts.total_cents} />
          </Elements>
        </div>
      </main>
    );
  }

  return (
    <main className="grain mx-auto max-w-md px-5 py-12">
      <h1 className="masthead-shadow anim-rise font-display text-4xl font-bold text-cream">Get tickets</h1>
      <p className="anim-rise mt-1 text-mauve-dim">{eventTitle}</p>

      <form onSubmit={submitDetails} noValidate className="anim-rise d-1 mt-8 space-y-5">
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

        {isTable ? (
          <div className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-cream">{tier.name}</p>
                <p className="text-sm text-mauve-dim">Admits up to {tier.seats} guests</p>
              </div>
              <span className="font-display text-lg tabular-nums text-cream">{usd(tier.price_cents)}</span>
            </div>
          </div>
        ) : (
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
        )}

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

        <div>
          <label className={label}>Promo code (optional)</label>
          <input
            className={`${field} uppercase`}
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="CODE"
            autoCapitalize="characters"
          />
          {errors.promo && <p className="mt-1 text-sm text-coral">{errors.promo}</p>}
        </div>

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
          {busy ? "One sec…" : `Continue — ${usd(tier.price_cents * effQty)}`}
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
