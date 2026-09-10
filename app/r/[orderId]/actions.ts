"use server";

import { headers } from "next/headers";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { submitReview } from "@/lib/reviews";
import type { ActionState } from "@/app/admin/action-state";

export async function submitReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const rl = rateLimit(`review:${clientIpFrom(h)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) return { status: "error", message: "Too many tries — give it a few minutes." };

  const orderId = String(formData.get("order_id") ?? "");
  const rating = parseInt(String(formData.get("rating") ?? "0"), 10);
  const text = String(formData.get("text") ?? "");
  if (!orderId || !(rating >= 1 && rating <= 5)) return { status: "error", fieldErrors: { rating: "Tap a star first." } };

  const result = await submitReview({ orderId, rating, text });
  if (result === "not_yet") return { status: "error", message: "Come back after the night — you can rate it then." };
  if (result === "invalid") return { status: "error", message: "That ticket link isn’t valid." };
  return { status: "success", message: "Thank you — that helps the next person decide." };
}
