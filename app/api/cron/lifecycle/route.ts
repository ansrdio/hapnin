import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runLifecycle } from "@/lib/lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily lifecycle emails (reminders + thank-yous). Two ways in:
//   - Vercel Cron: sends `Authorization: Bearer ${CRON_SECRET}` (set CRON_SECRET
//     in Vercel; the schedule lives in vercel.json).
//   - An admin session, e.g. to preview: /api/cron/lifecycle?dry=1 shows what
//     WOULD send without claiming or sending anything.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isCron = !!secret && auth === `Bearer ${secret}`;
  if (!isCron) await requireAdmin();

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const result = await runLifecycle({ dryRun });
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
