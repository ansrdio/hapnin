import { NextResponse } from "next/server";
import { requireOrganizer } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getEventGuests } from "@/lib/attendees";

export const runtime = "nodejs";

// Guest list as CSV — for the clipboard at the door, the promoter settlement,
// or whatever spreadsheet the organizer already lives in.
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizer } = await requireOrganizer();
  const event = await getEventById(id);
  if (!event || event.organizer_id !== organizer.id) return new NextResponse("Not found", { status: 404 });

  const guests = await getEventGuests(id);
  const rows: unknown[][] = [
    ["Name", "Phone", "Tier", "Quantity", "Channel", "Status", "Total (USD)", "Checked in", "Purchased"],
    ...guests.map((g) => [
      g.name,
      g.phone,
      g.tierName,
      g.quantity,
      g.channel,
      g.status,
      (g.totalCents / 100).toFixed(2),
      `${g.checkedIn}/${g.quantity}`,
      g.createdAt ? new Date(g.createdAt).toISOString() : "",
    ]),
  ];
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${event.slug}-guests.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
