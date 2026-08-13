import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Shared visual language for the product (dashboard, builder, manage screens).
// One source of truth for surfaces, buttons, inputs, and stats so every screen
// reads as the same app. Built on the brand tokens in tailwind.config.ts.

// ── Inputs ───────────────────────────────────────────────────────────────────
export const inputClass =
  "w-full rounded-xl border border-plum-hi bg-ink/50 px-3.5 py-2.5 text-cream placeholder:text-mauve-dim/50 outline-none transition-colors focus:border-gold";
export const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-mauve-dim/80">{hint}</p>}
      {error && <p className="mt-1 text-sm text-coral">{error}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} resize-none ${props.className ?? ""}`} />;
}

export function Select({
  options,
  placeholder = "Choose…",
  ...props
}: ComponentProps<"select"> & { options: readonly string[]; placeholder?: string }) {
  return (
    <select {...props} defaultValue={props.defaultValue ?? ""} className={`${inputClass} [color-scheme:dark] ${props.className ?? ""}`}>
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-display text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const buttonVariants = {
  primary: "bg-gold text-ink hover:bg-gold-hi",
  secondary: "border border-plum-hi bg-plum/40 text-cream hover:border-gold hover:bg-plum",
  ghost: "text-mauve-dim hover:text-cream",
  danger: "border border-coral/40 text-coral hover:bg-coral/10",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "primary"): string {
  return `${buttonBase} ${buttonVariants[variant]}`;
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button {...props} className={`${buttonClass(variant)} ${className ?? ""}`} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={`${buttonClass(variant)} ${className ?? ""}`} />;
}

// ── Surfaces ─────────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-plum-hi bg-plum/40 p-6 ${className ?? ""}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-mauve-dim transition-colors hover:text-cream">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-cream sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-mauve-dim">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

// ── Stats & badges ───────────────────────────────────────────────────────────
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-plum-hi bg-plum/40 p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-cream">{value}</div>
      {sub && <div className="mt-0.5 text-sm text-mauve-dim">{sub}</div>}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  draft: "border-mauve-dim/30 text-mauve-dim",
  on_sale: "border-emerald/40 text-emerald",
  sold_out: "border-gold/40 text-gold",
  past: "border-mauve-dim/30 text-mauve-dim/70",
  cancelled: "border-coral/40 text-coral",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "border-plum-hi text-mauve-dim";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="font-display text-lg font-semibold text-cream">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-mauve-dim">{children}</div>}
    </Card>
  );
}

// ── Money ────────────────────────────────────────────────────────────────────
export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
