"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { transferTickets } from "@/lib/transfers";
import { normalizeUsPhone, cleanText } from "@/lib/validation";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/app/admin/action-state";

// Transfer from the ticket page. The ticket link is the bearer credential (holding
// it means holding the ticket), so no login — but rate-limited.
export async function transferAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const h = await headers();
  const rl = rateLimit(`transfer:${clientIpFrom(h)}`, { limit: 6, windowMs: 60_000 });
  if (!rl.ok) return { status: "error", message: `Too many tries. Wait ${rl.retryAfterSec}s.` };

  const orderId = String(formData.get("order_id") ?? "");
  const count = parseInt(String(formData.get("count") ?? "1"), 10) || 1;
  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  const first_name = cleanText(String(formData.get("first_name") ?? ""), 80) || null;

  if (!phone) return { status: "error", fieldErrors: { phone: "Enter a US mobile number." } };

  try {
    await transferTickets({ orderId, count, recipient: { phone, first_name } });
    revalidatePath(`/t/${orderId}`);
    return { status: "success", message: `Sent ${count} ${count > 1 ? "tickets" : "ticket"}. They’ve been texted the link.` };
  } catch (err) {
    const m = (err as Error).message;
    if (m === "TOO_MANY") return { status: "error", message: "You don’t have that many tickets left to send." };
    console.error("transfer error", err);
    return { status: "error", message: "Couldn’t transfer. Try again." };
  }
}
