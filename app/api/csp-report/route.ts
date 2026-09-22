import { NextResponse } from "next/server";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Browsers POST Content-Security-Policy violation reports here (see
// next.config.mjs). We log one compact line per report so they show up in the
// Vercel function logs — and in Sentry via console capture — and answer 204.
// Public by necessity; small body cap and a per-IP limit keep it from being a
// free log-spam endpoint.

const MAX_BODY = 16 * 1024;

type LegacyReport = { "csp-report"?: Record<string, unknown> };
type ReportingApi = { body?: Record<string, unknown>; type?: string }[];

function pick(r: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export async function POST(req: Request) {
  const rl = rateLimit(`csp-report:${clientIpFrom(req.headers)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY) return new NextResponse(null, { status: 204 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Accept both the legacy report-uri shape and the Reporting API array shape.
  const reports: Record<string, unknown>[] = Array.isArray(parsed)
    ? (parsed as ReportingApi).map((r) => r.body ?? {})
    : [((parsed as LegacyReport)["csp-report"] ?? parsed) as Record<string, unknown>];

  for (const r of reports.slice(0, 5)) {
    const directive = pick(r, "effective-directive", "effectiveDirective", "violated-directive", "violatedDirective") ?? "?";
    const blocked = pick(r, "blocked-uri", "blockedURL", "blockedUri") ?? "?";
    const page = pick(r, "document-uri", "documentURL", "documentUri") ?? "?";
    const source = pick(r, "source-file", "sourceFile");
    const line = r["line-number"] ?? r["lineNumber"];
    console.warn(`csp-violation directive=${directive} blocked=${blocked} page=${page}${source ? ` source=${source}:${line ?? "?"}` : ""}`);
  }
  return new NextResponse(null, { status: 204 });
}
