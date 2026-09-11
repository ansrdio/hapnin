"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Appearance, StripeElementsOptions, StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Elements, PaymentElement, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe-client";

// Checkout, wallet first.
//
//   paid tier  → [tier · qty]  [ Apple Pay / Google Pay / Link ]  "or pay with card"
//                 Wallet path: the wallet hands us name, email, phone and ZIP, we
//                 create the PaymentIntent on the server from those, and confirm.
//                 One tap, no form.
//                 Card path: a short form (name, mobile, email), then the card.
//   free tier  → the short form, then the ticket. No Stripe anywhere.
//
// Every amount comes from the server: the quote endpoint prices the wallet
// button, and /api/checkout prices the PaymentIntent from the same code.

type Tier = { id: string; name: string; price_cents: number; remaining: number; kind: "ga" | "table"; seats: number | null };
type Amounts = { subtotal_cents: number; discount_cents: number; card_fee_cents: number; total_cents: number };
type Friend = { first_name: string; phone: string; email: string };

const usd = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);
const field =
  "w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-gold";
const primaryBtn =
  "w-full rounded-xl bg-gold px-6 py-4 font-display text-lg font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60";

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

const ERRORS: Record<string, string> = {
  sold_out: "That just sold out — pick another tier.",
  not_on_sale: "Tickets aren’t on sale right now.",
  organizer_not_ready: "This event isn’t set up to take payments yet. Try again shortly.",
  rate_limited: "Too many attempts from this connection — give it a minute.",
};

export function CheckoutClient({
  slug,
  eventTitle,
  refundPolicyLabel,
  consentText,
  tiers,
  promoterCode,
  preselectTierId,
  friendCode,
  onBehalfOf,
}: {
  slug: string;
  eventTitle: string;
  refundPolicyLabel?: string;
  consentText: string;
  tiers: Tier[];
  promoterCode?: string | null;
  preselectTierId?: string | null;
  friendCode?: string | null; // bring-a-friend share code from ?friend=
  onBehalfOf: string | null; // organizer's connected account (paid events)
}) {
  const initialTier = tiers.find((t) => t.id === preselectTierId)?.id ?? tiers[0].id;
  const [tierId, setTierId] = useState(initialTier);
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<"start" | "details" | "pay">("start");
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", zip: "" });
  const [screening, setScreening] = useState("");
  const [promo, setPromo] = useState("");
  const [more, setMore] = useState(false);
  const [optIn, setOptIn] = useState(true);
  const [showName, setShowName] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Amounts | null>(null);
  const [quote, setQuote] = useState<Amounts | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null); // null = not known yet

  const tier = tiers.find((t) => t.id === tierId)!;
  const isTable = tier.kind === "table";
  const isFree = tier.price_cents === 0;
  const maxQ = isTable ? 1 : Math.min(8, tier.remaining);
  const effQty = isTable ? 1 : qty;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Free tiers skip the wallet screen entirely.
  useEffect(() => {
    if (isFree && step === "start") setStep("details");
  }, [isFree, step]);

  // Price the wallet button from the server (nothing is reserved by a quote).
  const quoteSeq = useRef(0);
  useEffect(() => {
    if (isFree) return;
    const seq = ++quoteSeq.current;
    setQuote(null);
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, tierId, quantity: effQty, friend: friendCode ?? undefined }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (seq === quoteSeq.current && d?.amounts) setQuote(d.amounts);
      })
      .catch(() => {});
  }, [slug, tierId, effQty, friendCode, isFree]);

  const body = (extra: Record<string, unknown>) => ({
    slug,
    tierId,
    quantity: effQty,
    p: promoterCode ?? undefined,
    friend: friendCode ?? undefined,
    optIn,
    showName,
    friends: isTable ? [] : friends.slice(0, effQty - 1).filter((fr) => fr.phone.trim()),
    ...extra,
  });

  async function postCheckout(payload: Record<string, unknown>): Promise<Record<string, unknown> & { free?: boolean; orderId?: string; amounts?: Amounts; clientSecret?: string } | null> {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(data.fieldErrors ?? { form: ERRORS[data.error] ?? "Something went wrong. Try again." });
      return null;
    }
    return data;
  }

  // Card path (and free RSVP): the short form → Continue.
  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const data = await postCheckout(body({ ...f, screening, promo: promo.trim() || undefined }));
      if (!data) return setBusy(false);
      if (data.free && data.orderId) {
        window.location.assign(`/t/${data.orderId}`); // ticket already issued; keep busy on
        return;
      }
      if (!data.amounts || !data.clientSecret) {
        setErrors({ form: "Something went wrong. Try again." });
        return setBusy(false);
      }
      setAmounts(data.amounts);
      setClientSecret(data.clientSecret);
      setStep("pay");
      setBusy(false);
    } catch {
      setErrors({ form: "Something went wrong. Try again." });
      setBusy(false);
    }
  }

  // Wallet options: a deferred intent priced by the quote. onBehalfOf mirrors
  // the PaymentIntent (the organizer is the merchant of record).
  const walletOptions = useMemo<StripeElementsOptions | null>(() => {
    if (isFree || !quote || quote.total_cents <= 0) return null;
    return {
      mode: "payment",
      amount: quote.total_cents,
      currency: "usd",
      ...(onBehalfOf ? { onBehalfOf } : {}),
      appearance,
    };
  }, [isFree, quote, onBehalfOf]);

  const payOptions = useMemo<StripeElementsOptions | null>(() => (clientSecret ? { clientSecret, appearance } : null), [clientSecret]);

  // ── Step: pay by card ──────────────────────────────────────────────────────
  if (step === "pay" && payOptions && amounts) {
    return (
      <main className="grain mx-auto max-w-md px-5 py-12">
        <h1 className="anim-rise font-display text-3xl font-bold text-cream">Pay</h1>
        <p className="anim-rise mt-1 text-mauve-dim">{eventTitle}</p>
        <Summary amounts={amounts} />
        <div className="mt-6">
          <Elements stripe={getStripeClient()} options={payOptions}>
            <CardStep slug={slug} total={amounts.total_cents} refundPolicyLabel={refundPolicyLabel} />
          </Elements>
        </div>
      </main>
    );
  }

  // ── Step: details (card path) / RSVP (free) ────────────────────────────────
  if (step === "details") {
    return (
      <main className="grain mx-auto max-w-md px-5 py-12">
        <h1 className="anim-rise font-display text-4xl font-bold text-cream">{isFree ? "RSVP" : "Your details"}</h1>
        <p className="anim-rise mt-1 text-mauve-dim">
          {eventTitle}
          {!isFree && <> · {effQty}× {tier.name} · {usd(tier.price_cents * effQty)}</>}
        </p>
        {isFree ? (
          <p className="anim-rise mt-3 rounded-xl border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-cream">
            Free — no payment needed. Your ticket with a QR code lands in your email and on this phone the moment you confirm.
          </p>
        ) : (
          <button type="button" onClick={() => setStep("start")} className="anim-rise mt-2 text-sm text-mauve-dim underline decoration-plum-hi underline-offset-4 hover:text-cream">
            ← Back to Apple Pay / Google Pay
          </button>
        )}

        <form onSubmit={submitDetails} noValidate className="anim-rise d-1 mt-8 space-y-5">
          {isFree && <TierAndQty tiers={tiers} tierId={tierId} setTierId={setTierId} qty={qty} setQty={setQty} maxQ={maxQ} isTable={isTable} tier={tier} />}

          <FriendsRows show={!isTable && effQty >= 2} qty={effQty} friends={friends} setFriends={setFriends} isFree={isFree} />

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
            <p className="mt-1 text-xs text-mauve-dim">Your ticket link is texted here.</p>
            {errors.phone && <p className="mt-1 text-sm text-coral">{errors.phone}</p>}
          </div>
          <div>
            <label className={label}>Email</label>
            <input className={field} type="email" inputMode="email" value={f.email} onChange={set("email")} autoComplete="email" />
            {errors.email && <p className="mt-1 text-sm text-coral">{errors.email}</p>}
          </div>

          {!more ? (
            <button type="button" onClick={() => setMore(true)} className="text-sm text-gold underline decoration-gold/40 underline-offset-4 hover:text-gold-hi">
              {isFree ? "More options" : "Promo code or more options"}
            </button>
          ) : (
            <div className="space-y-5 rounded-xl border border-plum-hi bg-plum/30 p-4">
              {!isFree && (
                <div>
                  <label className={label}>Promo code</label>
                  <input className={`${field} uppercase`} value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="CODE" autoCapitalize="characters" />
                  {errors.promo && <p className="mt-1 text-sm text-coral">{errors.promo}</p>}
                </div>
              )}
              <div>
                <label className={label}>ZIP (optional)</label>
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
                      className={`flex-1 rounded-xl border px-3 py-2.5 capitalize ${screening === v ? "border-gold bg-gold/10 text-cream" : "border-plum-hi text-mauve-dim"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <Consents consentText={consentText} optIn={optIn} setOptIn={setOptIn} showName={showName} setShowName={setShowName} />

          {errors.form && <p className="text-sm text-coral">{errors.form}</p>}

          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy
              ? isFree ? "Getting your ticket…" : "One sec…"
              : isFree
                ? `Confirm — ${effQty === 1 ? "1 free ticket" : `${effQty} free tickets`}`
                : `Continue to card — ${usd(tier.price_cents * effQty)}`}
          </button>
        </form>
      </main>
    );
  }

  // ── Step: start (paid) — tier, quantity, wallet ────────────────────────────
  return (
    <main className="grain mx-auto max-w-md px-5 py-12">
      <h1 className="anim-rise font-display text-4xl font-bold text-cream">Get tickets</h1>
      <p className="anim-rise mt-1 text-mauve-dim">{eventTitle}</p>

      <div className="anim-rise d-1 mt-8 space-y-5">
        <TierAndQty tiers={tiers} tierId={tierId} setTierId={setTierId} qty={qty} setQty={setQty} maxQ={maxQ} isTable={isTable} tier={tier} />

        <FriendsRows show={!isTable && effQty >= 2} qty={effQty} friends={friends} setFriends={setFriends} isFree={false} />

        {quote && <Summary amounts={quote} compact />}

        {/* Wallet — one tap. Renders only when a wallet is available on this device. */}
        {walletOptions ? (
          <Elements key={`${tierId}-${effQty}-${quote!.total_cents}`} stripe={getStripeClient()} options={walletOptions}>
            <WalletButtons
              amount={quote!.total_cents}
              slug={slug}
              onReady={setHasWallet}
              onError={(msg) => setErrors({ form: msg })}
              onNeedsForm={(prefill) => {
                setF((p) => ({ ...p, ...prefill }));
                setStep("details");
              }}
              build={(walletFields) => body({ ...walletFields, wallet: true, promo: promo.trim() || undefined })}
            />
          </Elements>
        ) : (
          <div className="h-12 animate-pulse rounded-xl bg-plum/40" aria-hidden="true" />
        )}

        {hasWallet !== false && (
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-mauve-dim">
            <span className="h-px flex-1 bg-plum-hi" />
            or
            <span className="h-px flex-1 bg-plum-hi" />
          </div>
        )}

        <button type="button" onClick={() => setStep("details")} className={hasWallet === false ? primaryBtn : "w-full rounded-xl border border-plum-hi px-6 py-4 font-display text-lg font-semibold text-cream transition-colors hover:border-gold"}>
          Pay with card — {usd(tier.price_cents * effQty)}
        </button>

        <Consents consentText={consentText} optIn={optIn} setOptIn={setOptIn} showName={showName} setShowName={setShowName} />

        {errors.form && <p className="text-sm text-coral">{errors.form}</p>}
        {errors.promo && <p className="text-sm text-coral">{errors.promo}</p>}
        {refundPolicyLabel && <p className="text-center text-xs text-mauve-dim">{refundPolicyLabel}</p>}
      </div>
    </main>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function TierAndQty({
  tiers, tierId, setTierId, qty, setQty, maxQ, isTable, tier,
}: {
  tiers: Tier[]; tierId: string; setTierId: (id: string) => void; qty: number; setQty: (fn: (q: number) => number) => void; maxQ: number; isTable: boolean; tier: Tier;
}) {
  return (
    <>
      {tiers.length > 1 && (
        <div>
          <label className={label}>Ticket</label>
          <select
            value={tierId}
            onChange={(e) => { setTierId(e.target.value); setQty(() => 1); }}
            className={`${field} [color-scheme:dark]`}
          >
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {usd(t.price_cents)}</option>
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
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 rounded-xl border border-plum-hi text-xl text-cream hover:bg-plum" aria-label="Decrease">−</button>
            <span className="font-display text-xl tabular-nums text-cream">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(maxQ, q + 1))} className="h-11 w-11 rounded-xl border border-plum-hi text-xl text-cream hover:bg-plum" aria-label="Increase">+</button>
            <span className="ml-auto font-display text-lg tabular-nums text-cream">{usd(tier.price_cents * qty)}</span>
          </div>
        </div>
      )}
    </>
  );
}

function FriendsRows({ show, qty, friends, setFriends, isFree }: { show: boolean; qty: number; friends: Friend[]; setFriends: React.Dispatch<React.SetStateAction<Friend[]>>; isFree: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-plum-hi bg-plum/30 p-4">
      <p className="font-display font-semibold text-cream">
        Sending tickets to friends? <span className="text-sm font-normal text-mauve-dim">(optional)</span>
      </p>
      <p className="mt-0.5 text-xs text-mauve-dim">
        Add their mobile and each gets their own ticket the moment you {isFree ? "confirm" : "pay"}. Leave blank to keep them all on your phone.
      </p>
      <div className="mt-3 space-y-2">
        {Array.from({ length: qty - 1 }).map((_, i) => {
          const fr = friends[i] ?? { first_name: "", phone: "", email: "" };
          const set = (k: keyof Friend) => (e: React.ChangeEvent<HTMLInputElement>) =>
            setFriends((prev) => {
              const next = [...prev];
              while (next.length <= i) next.push({ first_name: "", phone: "", email: "" });
              next[i] = { ...next[i], [k]: e.target.value };
              return next;
            });
          return (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <input className={field} placeholder={`Friend ${i + 1} name`} value={fr.first_name} onChange={set("first_name")} />
              <input className={field} type="tel" inputMode="tel" placeholder="Mobile" value={fr.phone} onChange={set("phone")} />
              <input className={`${field} col-span-2 sm:col-span-1`} type="email" inputMode="email" placeholder="Email (optional)" value={fr.email} onChange={set("email")} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Consents({ consentText, optIn, setOptIn, showName, setShowName }: { consentText: string; optIn: boolean; setOptIn: (v: boolean) => void; showName: boolean; setShowName: (v: boolean) => void }) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm leading-relaxed text-mauve-dim">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-1 accent-gold" />
        <span>
          {consentText}{" "}
          <a href="/privacy" target="_blank" rel="noopener" className="text-gold hover:underline">Privacy</a>
          {" · "}
          <a href="/terms" target="_blank" rel="noopener" className="text-gold hover:underline">Terms</a>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-mauve-dim">
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="mt-1 accent-gold" />
        <span>Show my first name on the event page (“Ada, Chidi and 41 others going”). First name only, never your contact details.</span>
      </label>
    </div>
  );
}

function Summary({ amounts, compact = false }: { amounts: Amounts; compact?: boolean }) {
  return (
    <dl className={`${compact ? "mt-0" : "mt-6"} space-y-1.5 text-sm`}>
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
  );
}

/**
 * Apple Pay / Google Pay / Link on a deferred intent. On confirm: the wallet's
 * billing details become the buyer, the server creates the PaymentIntent, and
 * we confirm it with the same Elements instance.
 */
function WalletButtons({
  amount,
  slug,
  onReady,
  onError,
  onNeedsForm,
  build,
}: {
  amount: number;
  slug: string;
  onReady: (has: boolean) => void;
  onError: (msg: string) => void;
  onNeedsForm: (prefill: Partial<{ firstName: string; lastName: string; phone: string; email: string; zip: string }>) => void;
  build: (walletFields: Record<string, unknown>) => Record<string, unknown>;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function onConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) return;
    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message || "Couldn’t start the payment. Try again.");
      return;
    }
    const bd = event.billingDetails;
    const name = (bd?.name ?? "").trim();
    const [firstName, ...rest] = name.split(/\s+/);
    const fields = {
      firstName: firstName || "Guest",
      lastName: rest.join(" "),
      email: bd?.email ?? "",
      phone: bd?.phone ?? "",
      zip: bd?.address?.postal_code ?? "",
    };
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(build(fields)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      event.paymentFailed({ reason: "fail" });
      if (data.fieldErrors?.phone || data.fieldErrors?.email) {
        // The wallet didn't share a usable mobile/email — finish on the short form, prefilled.
        onNeedsForm(fields);
        onError("Your wallet didn’t share a US mobile number — add it below and pay by card.");
      } else {
        onError(data.fieldErrors?.promo ?? ERRORS[data.error] ?? "Something went wrong. Try again.");
      }
      return;
    }
    if (data.amounts?.total_cents !== amount) {
      // The server priced it differently (a code stopped applying) — resync and let them tap again.
      event.paymentFailed({ reason: "fail" });
      onError("The total changed — tap again to pay the updated amount.");
      window.location.reload();
      return;
    }
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret: data.clientSecret,
      confirmParams: { return_url: `${window.location.origin}/e/${slug}/confirmation` },
    });
    if (error) onError(error.message || "Payment failed. Try again.");
    // On success Stripe redirects to the confirmation page.
  }

  return (
    <ExpressCheckoutElement
      options={{
        emailRequired: true,
        phoneNumberRequired: true,
        billingAddressRequired: true,
        // Wallets only — pay-later and PayPal-style buttons confuse a ticket purchase.
        paymentMethods: { klarna: "never", paypal: "never", amazonPay: "never" },
        buttonHeight: 50,
        layout: { maxColumns: 1, overflow: "never" },
      }}
      onReady={({ availablePaymentMethods }) => onReady(!!availablePaymentMethods)}
      onConfirm={onConfirm}
    />
  );
}

/** Card form on a real PaymentIntent (after the short details form). */
function CardStep({ slug, total, refundPolicyLabel }: { slug: string; total: number; refundPolicyLabel?: string }) {
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
  }

  return (
    <form onSubmit={pay} className="mt-2 space-y-5">
      <p className="text-sm text-mauve-dim">Card processing is included — the organizer keeps the face value.</p>
      <PaymentElement options={{ wallets: { applePay: "never", googlePay: "never" } }} />
      {err && <p className="text-sm text-coral">{err}</p>}
      <button type="submit" disabled={busy || !stripe} className={primaryBtn}>
        {busy ? "Processing…" : `Pay ${usd(total)}`}
      </button>
      {refundPolicyLabel && <p className="text-center text-xs text-mauve-dim">{refundPolicyLabel}</p>}
    </form>
  );
}
