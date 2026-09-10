import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, normalizeUsPhone } from "@/lib/validation";
import { emailMyTickets } from "@/lib/find-tickets";

export const runtime = "nodejs";

// POST { q } — an email or US phone. Always answers the same way; the only
// effect is an email to the address on file, if any. Rate-limited per IP.
export async function POST(req: Request) {
  const ip = clientIpFrom(await headers());
  const rl = rateLimit(`find-tickets:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { q?: unknown };
  const q = String(body.q ?? "").trim();
  const email = normalizeEmail(q);
  const phone = email ? null : normalizeUsPhone(q);
  if (!email && !phone) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    await emailMyTickets({ email, phone });
  } catch (err) {
    console.error("find-tickets error", err);
  }
  return NextResponse.json({ ok: true });
}
