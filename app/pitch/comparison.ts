// Competitor comparison for /pitch — the single source of truth for every value
// in the table. This is the highest-risk content on the site: a wrong number
// about a named platform on a public page is a real problem. Correct rates HERE
// and nowhere else, and bump `LAST_VERIFIED` when you do.
//
// Verified August 2026 against each platform's published rates and current
// third-party breakdowns:
//   Hapnin        — our own ongoing rate (must match HAPNIN in FeeCalculator.tsx)
//   Posh          — 10% + $0.99, shown all-in (2026)
//   Eventbrite    — 3.7% + $1.79 service + 2.9% processing; paid tickets sellable
//                   with no mandatory subscription (Pro plan is optional)
//   Ticket Tailor — flat per-ticket, no %: ~$0.30 prepaid to ~$0.85 pay-as-you-sell
//
// Cell values: "yes" → tick, "no" → dash, anything else → shown as text.

export const LAST_VERIFIED = "August 2026";

export const platforms = ["Hapnin", "Posh", "Eventbrite", "Ticket Tailor"] as const;

export type Row = {
  label: string;
  anchor?: boolean; // fee rows + the two exclusive rows — the visual anchors
  // [Hapnin, Posh, Eventbrite, Ticket Tailor]
  values: [string, string, string, string];
};

export const rows: Row[] = [
  {
    label: "Platform fee",
    anchor: true,
    values: ["3% + $0.50", "10% + $0.99", "3.7% + $1.79", "~$0.30–$0.85 flat"],
  },
  {
    label: "On a $40 ticket",
    anchor: true,
    values: ["$1.70", "$4.99", "$3.27", "under $1"],
  },
  {
    label: "On a $150 table seat",
    anchor: true,
    values: ["$5.00", "$15.99", "$7.34", "under $1"],
  },
  {
    label: "Card processing",
    values: ["2.9% + 30¢ · Stripe, direct", "Bundled", "2.9% on top", "Your own Stripe"],
  },
  {
    label: "Where the money lands",
    values: [
      "Your own Stripe account",
      "Platform, instant payout",
      "Platform, ~4–5 days after event",
      "Your own Stripe account",
    ],
  },
  {
    label: "SMS to attendees",
    values: ["yes", "yes", "Third-party", "no"],
  },
  {
    label: "Offline door scanning",
    values: ["yes", "yes", "yes", "yes"],
  },
  {
    label: "Promoter commission links",
    values: ["Coming", "yes", "no", "no"],
  },
  {
    label: "Discovery feed",
    values: ["None", "Yes — thins out fast", "Yes — large, general", "None"],
  },
  {
    label: "Tagged by community, language, genre",
    anchor: true,
    values: ["yes", "no", "no", "no"],
  },
  {
    label: "Audience carries across organizers",
    anchor: true,
    values: ["yes", "Within platform", "no", "no"],
  },
];
