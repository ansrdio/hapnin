// Ordered source registry for the /why essay. Ref and References read from the
// same list, so footnote numbers and the reference block can never fall out of
// sync. Every entry carries the date its figure was current.

export type Source = {
  key: string;
  label: string; // full citation, shown in the references block
  url: string;
  dated: string; // when the figure was current / last reviewed
};

export const SOURCES: Source[] = [
  {
    key: "mpi",
    label:
      "Migration Policy Institute, “Sub-Saharan African Immigrants in the United States” — population, growth, and geographic distribution.",
    url: "https://www.migrationpolicy.org/article/sub-saharan-african-immigrants-united-states-2025",
    dated: "2024 data, published 2025",
  },
  {
    key: "pew",
    label:
      "Pew Research Center, “Key findings about Black immigrants in the U.S.” — origins and growth of the Black immigrant population.",
    url: "https://www.pewresearch.org/short-reads/2026/03/20/key-findings-about-black-immigrants-in-the-us/",
    dated: "published 2026",
  },
  {
    key: "fees",
    label:
      "Organizer fee schedules published by Eventbrite and Posh. Effective rates vary by ticket price and plan; figures characterized as a range, not a quoted rate.",
    url: "https://www.eventbrite.com/organizer/pricing/",
    dated: "reviewed August 2026",
  },
  {
    key: "nollywood",
    label:
      "U.S. Department of Commerce, Nigeria Media & Entertainment guide, and UNESCO, on Nollywood’s output and scale.",
    url: "https://www.trade.gov/country-commercial-guides/nigeria-media-and-entertainment",
    dated: "reviewed August 2026",
  },
];

export const sourceIndex: Record<string, { n: number; src: Source }> = Object.fromEntries(
  SOURCES.map((src, i) => [src.key, { n: i + 1, src }])
);
