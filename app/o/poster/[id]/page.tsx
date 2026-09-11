import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireOrganizer } from "@/lib/auth";
import { getEventById, getTiers } from "@/lib/events";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Poster — Hapnin", robots: { index: false } };

// A printable table-tent / door poster: the event, a big QR to its page, and
// the short link for anyone who'd rather type. Sits outside the dashboard
// layout so the print is just the poster. Letter and A4 both fit.
export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) notFound();
  const tiers = await getTiers(id);
  const free = tiers.length > 0 && tiers.every((t) => t.price_cents === 0);

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";
  const url = `${site}/e/${event.slug}`;
  const short = `${site.replace(/^https?:\/\//, "")}/e/${event.slug}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#1B0A2A", light: "#ffffff" } });

  const tz = event.timezone || "America/Phoenix";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(new Date(event.starts_at));
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(event.starts_at));

  return (
    <main className="min-h-[100svh] bg-neutral-200 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[8.5in] items-center justify-between gap-3 print:hidden">
        <a href={`/o/events/${id}`} className="text-sm text-neutral-600 hover:text-neutral-900">← {event.title}</a>
        <PrintButton />
      </div>

      <div className="mx-auto flex aspect-[8.5/11] w-full max-w-[8.5in] flex-col bg-white p-[0.75in] text-[#1B0A2A] shadow-xl print:max-w-none print:shadow-none">
        <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-[#8a5a12]">
          <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#F2593F]" aria-hidden="true" />
          Hapnin
        </p>
        <h1 className="mt-4 font-display text-[44pt] font-bold leading-[1.02]">{event.title}</h1>
        <p className="mt-3 text-[16pt] leading-snug text-neutral-700">
          {day} · {time}
          {event.venue_name ? <><br />{event.venue_name}</> : null}
        </p>

        <div className="mt-auto flex items-end gap-10">
          <div className="w-[3.2in] shrink-0 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div>
            <p className="font-display text-[26pt] font-bold leading-tight">{free ? "Scan to RSVP." : "Scan for tickets."}</p>
            <p className="mt-2 text-[13pt] text-neutral-700">
              {free ? "Free. Your ticket lands on your phone in ten seconds." : "Apple Pay, Google Pay or card. Ticket on your phone in ten seconds."}
            </p>
            <p className="mt-5 text-[11pt] uppercase tracking-[0.2em] text-neutral-500">or go to</p>
            <p className="font-display text-[16pt] font-semibold">{short}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
