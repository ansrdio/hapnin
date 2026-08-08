// Shared copy + data for the /pitch slideshow and the /pitch/read fallback,
// so the two can never drift apart. v2 argument: they already have good tools —
// this is about overpaying for discovery that doesn't reach Phoenix yet.

export const copy = {
  heroEyebrow: "For organizers",

  // 1 — concede
  concedeTitle: "You already have ticketing. And it works.",
  concedeDeck:
    "This isn’t about your checkout page. It’s about what you’re paying for the part of it that doesn’t work where you live.",

  // 2 — what the fee is for
  feeHeading: "What that fee is actually for.",
  feeBody:
    "On a culture-led platform, the deal is roughly a 10%-plus-per-ticket cut in exchange for a discovery feed that brings you buyers. In New York or Atlanta that’s a real trade — on a well-placed event, a meaningful share of tickets come from people who found it in the app.",

  // 3 — the question (loud, alone)
  questionHeading: "Where did the people at your last event actually come from?",

  // 4 — the answer
  answerLead:
    "Your Instagram. Your WhatsApp groups. Your promoters. A flyer in someone’s story. Someone’s cousin.",
  answerPunch: "You did the marketing. You paid the marketplace.",
  answerStructural:
    "That’s not the platform failing. The feed just needs a density Phoenix doesn’t have yet — the platforms say as much about smaller markets themselves. It’s a structural mismatch, not a bad product.",

  // 5 — calculator
  calcHeading: "What you’d keep.",
  calcSub:
    "300 tickets at $40, at a marketplace fee tier — on buyers you brought yourself. Set the rate to match your own plan.",

  // 6 / 7 — what you get
  expectHeading: "Everything you already expect.",
  expectSub: "No downgrade. All of it works on the night:",
  uniqueHeading: "And two things you can’t get anywhere else.",

  // 8 — the offer
  offerHeading: "Your first event costs you nothing.",
  offerBody:
    "No platform fee. Ticket money goes straight into your own Stripe account — not ours, not held, not on a payout schedule. Buyers cover card processing, same as anywhere.",

  // 9 — honesty
  honestHeading: "Here’s what we don’t have.",
  honestBody:
    "No discovery feed. No marketplace, no two million monthly visitors, no explore page. We’re new, and pretending otherwise would insult you.",
  honestTurn:
    "Here’s the thing: in Phoenix you weren’t getting that benefit anyway. You were paying for it. What we do have is your city, your community, tools that hold up on the night, and no cut of a room you filled yourself.",

  // 10 — what we ask
  trustEyebrow: "What we ask in return",
  trustHeading: "One thing, and we’re upfront about it.",
  trustBody:
    "At checkout, your buyers can opt in to hear from Hapnin about other African events near them.",
  whyWeAsk:
    "Why we ask — nobody has a picture of where African audiences actually are in this country. Which cities, which crowds, what they’d turn out for. Every ticket answers a little of it. That’s what eventually lets us bring people to your room instead of just processing their payment.",

  // 11 — bio
  bioHeading: "Who you’re dealing with.",
  bio:
    "I’m Jii, in Phoenix. I work in security, I write about African culture and institutions, and I built a version of this years ago that failed — I tried to build a platform before I’d filled a single room. This time it’s one city, one organizer, one event, and the software stays small until it’s earned its keep.",
  bioClose:
    "You’d be the first. That’s a real thing to ask, so the terms are built to make it easy to say yes and easy to walk away.",

  // 12 — ask
  askHeading: "Let’s run one event.",
  askBody:
    "Tell me what’s next on your calendar and I’ll set it up. About twenty minutes of your time.",
} as const;

// The room sources — read aloud on the "answer" beat.
export const roomSources: string[] = [
  "Your Instagram",
  "Your WhatsApp groups",
  "Your promoters",
  "A flyer in someone’s story",
  "Someone’s cousin",
];

export const expected: [string, string][] = [
  ["Ticket page and checkout", "Built for a phone at 11pm on mobile data. Apple Pay and Google Pay."],
  ["Tickets by text", "Not email."],
  [
    "A door that works offline",
    "Scans keep working when the venue wifi doesn’t, and sync when it comes back.",
  ],
  ["Text everyone who bought", "Doors moved, running late, parking."],
  ["Live sales", "Tiers, and how fast, how far out."],
  ["Comps and guest list", "Real tickets to your people, searchable at the door."],
  ["Payouts to your own Stripe", "Not held, not on our schedule."],
];

export const unique: [string, string][] = [
  [
    "Your event, described the way your audience thinks",
    "Not filed under “nightlife.” Tagged by community, language and genre — Nigerian, Yoruba, afrobeats, Nollywood — because that’s what actually decides who shows up.",
  ],
  [
    "An audience that carries across the whole scene",
    "Not just your own list. Someone who came to a comedy night in March is findable for your show in June.",
  ],
];

export const trustPoints: string[] = [
  "You get that list too. Yours, exported any time.",
  "Not exclusive. Keep using whatever you use. Nothing locks you in.",
  "We never message your buyers about someone else’s event unless they opted in.",
];
