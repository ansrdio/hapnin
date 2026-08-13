import Link from "next/link";
import { requireScanAccess } from "@/lib/auth";
import { listEventsByOrganizer } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function ScanHome() {
  const { organizer } = await requireScanAccess();
  const events = await listEventsByOrganizer(organizer.id);

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="font-display text-2xl font-semibold text-cream">Door scanner</h1>
      <p className="mt-1 text-mauve-dim">Pick the event you’re working.</p>
      <ul className="mt-6 space-y-3">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/scan/${e.id}`}
              className="block rounded-2xl border border-plum-hi bg-plum/40 px-5 py-4 hover:border-gold"
            >
              <span className="font-display text-lg font-semibold text-cream">{e.title}</span>
              <span className="block text-sm text-mauve-dim">{e.status}</span>
            </Link>
          </li>
        ))}
        {events.length === 0 && <li className="text-mauve-dim">No events yet.</li>}
      </ul>
    </main>
  );
}
