// Pure calendar helpers — no server deps, so routes and pages can both use them.
// Events have a start but no end; assume a night out runs DEFAULT_DURATION_MS.

export const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000;

export type CalendarEvent = {
  uid: string;
  title: string;
  startsAt: number; // epoch ms
  endsAt: number; // epoch ms
  location: string;
  description: string;
  url: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ICS/Google "basic" UTC timestamp: 20260912T053900Z */
export function toIcsUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

// RFC 5545 text escaping.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs(e: CalendarEvent): string {
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Hapnin//Tickets//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${toIcsUtc(Date.now())}`,
      `DTSTART:${toIcsUtc(e.startsAt)}`,
      `DTEND:${toIcsUtc(e.endsAt)}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(e.description)}`,
      `URL:${e.url}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toIcsUtc(e.startsAt)}/${toIcsUtc(e.endsAt)}`,
    details: e.description,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
