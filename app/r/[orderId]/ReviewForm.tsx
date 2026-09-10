"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitReviewAction } from "./actions";
import { initialActionState } from "@/app/admin/action-state";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabled}
      className="w-full rounded-xl bg-gold px-6 py-3.5 font-display font-semibold text-ink transition-colors hover:bg-gold-hi disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send my rating"}
    </button>
  );
}

export function ReviewForm({
  orderId,
  organizerHandle,
  existing,
}: {
  orderId: string;
  organizerHandle: string;
  existing: { rating: number; text: string | null } | null;
}) {
  const [state, action] = useActionState(submitReviewAction, initialActionState);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const err = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <div role="status" className="anim-rise rounded-2xl border border-emerald/40 bg-emerald/10 px-5 py-4">
        <p className="font-display font-semibold text-cream">{state.message}</p>
        {organizerHandle && (
          <a href={`/o/${organizerHandle}`} className="mt-2 inline-block text-sm text-gold hover:underline">
            See what’s next from them →
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className={`text-4xl leading-none transition-transform hover:scale-110 ${(hover || rating) >= n ? "text-gold" : "text-plum-hi"}`}
          >
            ★
          </button>
        ))}
      </div>
      {err.rating && <p className="text-sm text-coral">{err.rating}</p>}
      <textarea
        name="text"
        rows={4}
        maxLength={500}
        defaultValue={existing?.text ?? ""}
        placeholder="What made the night? (optional — first name only is shown)"
        className="w-full rounded-xl border border-plum-hi bg-plum px-4 py-3.5 text-cream placeholder:text-mauve-dim/60 focus:border-gold"
      />
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit disabled={rating === 0} />
    </form>
  );
}
