"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="group relative inline-flex w-full items-center justify-center rounded-xl bg-gold px-6 py-4 font-display text-lg font-semibold text-ink transition-[transform,background-color,box-shadow] duration-200 hover:bg-gold-hi hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(244,178,76,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "One sec…" : children}
    </button>
  );
}
