import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sweepExpiredHolds } from "@/lib/checkout";

export const runtime = "nodejs";

// Backstop sweeper for abandoned holds. The primary path runs scoped-per-event
// right before every new reservation (see createCheckout); this endpoint
// sweeps everything. Two ways in:
//   - Vercel Cron: sends `Authorization: Bearer ${CRON_SECRET}` (set CRON_SECRET
//     in Vercel and add a schedule in vercel.json to enable).
//   - An admin session, so it can be run on demand from the browser.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isCron = !!secret && auth === `Bearer ${secret}`;
  if (!isCron) await requireAdmin();

  const counts = await sweepExpiredHolds({ limit: 200 });
  return NextResponse.json({ ok: true, ...counts, at: new Date().toISOString() });
}
