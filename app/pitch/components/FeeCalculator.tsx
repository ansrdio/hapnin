"use client";

import { useMemo, useState } from "react";

// Card processing lives in ONE place so it's trivial to update. Real Stripe
// standard rate. Buyers cover this on both sides, so it never changes what the
// organizer keeps — it's shown only for transparency.
const CARD = { percent: 2.9, fixed: 0.3 };

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function clampNum(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function FeeCalculator() {
  const [tickets, setTickets] = useState(300);
  const [price, setPrice] = useState(40);
  const [pct, setPct] = useState(10); // marketplace-tier fee %
  const [perTicket, setPerTicket] = useState(1.5); // marketplace per-ticket fee

  const m = useMemo(() => {
    const gross = tickets * price;
    const cardFees = gross * (CARD.percent / 100) + CARD.fixed * tickets;
    const typicalFee = gross * (pct / 100) + perTicket * tickets;
    const hapninKeep = gross; // 0% platform fee, card covered by buyers
    const typicalKeep = gross - typicalFee;
    const diff = hapninKeep - typicalKeep; // == typicalFee
    return { gross, cardFees, typicalFee, hapninKeep, typicalKeep, diff };
  }, [tickets, price, pct, perTicket]);

  return (
    <div>
      {/* Inputs */}
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
        <SliderField
          id="calc-tickets"
          label="Tickets sold"
          value={tickets}
          min={0}
          max={1000}
          step={5}
          onChange={(v) => setTickets(clampNum(Math.round(v), 0, 1000))}
          format={(v) => String(v)}
        />
        <SliderField
          id="calc-price"
          label="Ticket price"
          value={price}
          min={0}
          max={200}
          step={1}
          prefix="$"
          onChange={(v) => setPrice(clampNum(Math.round(v), 0, 200))}
          format={(v) => String(v)}
        />
      </div>

      {/* Two panels */}
      <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* On Hapnin — lit */}
        <div className="rounded-2xl border border-gold/45 bg-gold/[0.07] p-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rotate-45 bg-gold" aria-hidden="true" />
            <h3 className="font-display text-lg font-semibold text-cream">On Hapnin</h3>
          </div>
          <dl className="mt-5 space-y-3 text-[15px]">
            <Row label="Gross" value={usd0.format(m.gross)} />
            <Row label="Platform fee (0%)" value={usd0.format(0)} />
            <Row
              label="Card processing"
              value={`${usd0.format(m.cardFees)}`}
              hint="covered by buyers"
            />
          </dl>
          <div className="mt-5 border-t border-gold/25 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm uppercase tracking-[0.14em] text-gold">You keep</span>
              <span className="font-display text-2xl font-bold tabular-nums text-cream">
                {usd0.format(m.hapninKeep)}
              </span>
            </div>
          </div>
        </div>

        {/* Marketplace tier — muted, editable */}
        <div className="rounded-2xl border border-plum-hi bg-plum p-6">
          <h3 className="font-display text-lg font-semibold text-mauve-dim">
            Marketplace tier
          </h3>
          <dl className="mt-5 space-y-3 text-[15px]">
            <Row label="Gross" value={usd0.format(m.gross)} muted />
            <Row
              label="Platform fee"
              value={`−${usd0.format(m.typicalFee)}`}
              muted
            />
            <Row
              label="Card processing"
              value={`${usd0.format(m.cardFees)}`}
              hint="covered by buyers"
              muted
            />
          </dl>
          <div className="mt-5 border-t border-plum-hi pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm uppercase tracking-[0.14em] text-mauve-dim">
                You keep
              </span>
              <span className="font-display text-2xl font-bold tabular-nums text-mauve-dim">
                {usd0.format(m.typicalKeep)}
              </span>
            </div>
          </div>

          {/* Editable estimate */}
          <fieldset className="mt-5 rounded-xl bg-ink/40 p-4">
            <legend className="px-1 text-xs text-mauve-dim">
              Estimate for this tier — set it to your own plan
            </legend>
            <div className="mt-1 flex flex-wrap items-end gap-4">
              <MiniNumber
                id="calc-pct"
                label="Fee %"
                value={pct}
                min={0}
                max={20}
                step={0.5}
                suffix="%"
                onChange={(v) => setPct(clampNum(v, 0, 20))}
              />
              <MiniNumber
                id="calc-perticket"
                label="Per ticket"
                value={perTicket}
                min={0}
                max={10}
                step={0.01}
                prefix="$"
                onChange={(v) => setPerTicket(clampNum(v, 0, 10))}
              />
            </div>
          </fieldset>
        </div>
      </div>

      {/* Headline difference */}
      <p
        className="mt-8 font-display text-3xl font-bold text-cream sm:text-4xl"
        aria-live="polite"
      >
        You keep <span className="text-gold tabular-nums">{usd0.format(Math.max(0, m.diff))}</span>{" "}
        more.
      </p>
      {/* The quiet line that is the whole argument. */}
      <p className="mt-2 font-display text-lg text-mauve-dim">On tickets you sold yourself.</p>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-mauve-dim/80">
        Card fees are the same rails either way and buyers cover them — so the gap above is purely
        the platform&rsquo;s cut.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-mauve-dim" : "text-cream/80"}>
        {label}
        {hint && <span className="ml-1.5 text-xs text-mauve-dim">· {hint}</span>}
      </dt>
      <dd className={`tabular-nums ${muted ? "text-mauve-dim" : "text-cream"}`}>{value}</dd>
    </div>
  );
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  prefix,
  onChange,
  format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
          {label}
        </label>
        <div className="flex items-center rounded-lg border border-plum-hi bg-plum px-2.5 py-1">
          {prefix && <span className="text-mauve-dim">{prefix}</span>}
          <input
            aria-label={`${label} (exact value)`}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-16 bg-transparent text-right font-display font-semibold text-cream focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-plum-hi accent-gold"
      />
      <div className="mt-1 flex justify-between text-[11px] text-mauve-dim/70">
        <span>{prefix}{format(min)}</span>
        <span>{prefix}{format(max)}</span>
      </div>
    </div>
  );
}

function MiniNumber({
  id,
  label,
  value,
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-mauve-dim">
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-plum-hi bg-ink/60 px-2.5 py-1.5">
        {prefix && <span className="text-mauve-dim">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-14 bg-transparent text-right font-medium text-cream focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="text-mauve-dim">{suffix}</span>}
      </div>
    </div>
  );
}
