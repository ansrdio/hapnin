// Client-safe (no server-only) so both the event forms and the server can share
// one source of truth for refund-policy values and their buyer-facing labels.

export type RefundPolicy = "none" | "7day" | "anytime";

export const REFUND_POLICIES: readonly RefundPolicy[] = ["none", "7day", "anytime"];

/** Long label — used on the event page / checkout where buyers read the terms. */
export const REFUND_POLICY_LABELS: Record<RefundPolicy, string> = {
  none: "All sales final — no refunds",
  "7day": "Refundable up to 7 days before the event",
  anytime: "Refundable anytime before the event",
};

/** Short label — used in the organizer's form dropdown. */
export const REFUND_POLICY_SHORT: Record<RefundPolicy, string> = {
  none: "All sales final (no refunds)",
  "7day": "Refundable up to 7 days before",
  anytime: "Refundable anytime before the event",
};

export function isRefundPolicy(v: string): v is RefundPolicy {
  return (REFUND_POLICIES as readonly string[]).includes(v);
}
