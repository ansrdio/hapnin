import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireScanAccess } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getDoorStats } from "@/lib/door";
import { ScreenBoard } from "./ScreenBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live board — Hapnin", robots: { index: false } };

// The projector / TV view for the room: who's in, who just walked in, and a
// QR code the room can point a phone at. `?qr=host` swaps the QR from the
// event page to the organizer sign-up (for a night where the guests ARE the
// organizers we're recruiting).
export default async function ScreenBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ qr?: string }>;
}) {
  const { eventId } = await params;
  const { qr } = await searchParams;
  const { organizer } = await requireScanAccess();
  const event = await getEventById(eventId);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const s = await getDoorStats(eventId);

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const host = site.replace(/^https?:\/\//, "");
  const target =
    qr === "host"
      ? { url: `${site}/host?src=launch-night`, caption: "Scan to host on Hapnin", text: `${host}/host` }
      : { url: `${site}/e/${event.slug}`, caption: event.tickets_sold > 0 ? "Scan to get in" : "Scan to RSVP", text: `${host}/e/${event.slug}` };
  const qrSvg = await QRCode.toString(target.url, { type: "svg", margin: 0, color: { dark: "#1B0A2A", light: "#ffffff" } });

  const whenText = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone || "America/Phoenix",
  }).format(new Date(event.starts_at));

  return (
    <ScreenBoard
      title={event.title}
      whenText={[whenText, event.venue_name].filter(Boolean).join(" · ")}
      stats={{ checkedIn: s.checkedIn, sold: s.sold, recent: s.recent }}
      qrSvg={qrSvg}
      qrCaption={target.caption}
      qrUrlText={target.text}
    />
  );
}
