import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { sanitizeAttribution } from "@/lib/attribution";
import { isDiscoveryEvent, recordDiscoveryEvent } from "@/lib/discovery";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Discovery beacon (Experiment 001). The browser sends one small JSON body per
// tracked action via navigator.sendBeacon. We keep: the action name, the ids
// involved, and the sanitized visit context. We never store the IP (used only
// for the in-memory rate limit) or the user agent (used only to drop crawlers).

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const cleanId = (v: unknown) => (typeof v === "string" && ID.test(v) ? v : null);

export async function POST(req: Request) {
  const h = await headers();
  if (BOT.test(h.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  const rl = rateLimit(`track:${clientIpFrom(h)}`, { limit: 240, windowMs: 60_000 });
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > 4096) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (!isDiscoveryEvent(body.name)) return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  const attribution = sanitizeAttribution(body.attribution);
  if (!attribution) return NextResponse.json({ error: "no_visit" }, { status: 400 });
  const subject = (body.subject ?? {}) as Record<string, unknown>;
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : null;

  try {
    await recordDiscoveryEvent({
      name: body.name,
      attribution,
      place_id: cleanId(subject.place_id),
      story_id: cleanId(subject.story_id),
      event_id: cleanId(subject.event_id),
      path,
    });
  } catch (err) {
    console.error("discovery beacon write failed", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  return new NextResponse(null, { status: 204 });
}
