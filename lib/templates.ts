// Event templates for the scene — client-safe (the builder reads them in the
// browser). A template only prefills the form; everything stays editable and
// nothing is saved until the organizer hits Publish or Save as draft. Prices
// are dollars here (the form field is dollars); 0 = free / RSVP.

import type { EventType, Community, LanguageCode, Genre } from "./enums";
import type { RefundPolicy } from "./refund-policy";

export type TemplateTier = { name: string; price: number; qty: number };

export type EventTemplate = {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
  title: string;
  description: string;
  event_type: EventType;
  community: Community;
  primary_language: LanguageCode;
  genre: Genre;
  refund_policy: RefundPolicy;
  capacity: number | null;
  referral_off: number; // dollars; 0 = off
  tiers: TemplateTier[];
  tip?: string; // one line shown after picking
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "afrobeats-night",
    emoji: "🎧",
    name: "Afrobeats night",
    blurb: "The Friday or Saturday party. Early bird, general, VIP.",
    title: "Afrobeats Night",
    description:
      "Afrobeats all night — the hits, the new ones, the ones you scream to. Doors 9pm. 21+ with ID. Dress to be seen.",
    event_type: "nightlife",
    community: "nigerian",
    primary_language: "mixed",
    genre: "afrobeats",
    refund_policy: "none",
    capacity: 300,
    referral_off: 5,
    tiers: [
      { name: "Early Bird", price: 15, qty: 75 },
      { name: "General", price: 25, qty: 175 },
      { name: "VIP", price: 45, qty: 50 },
    ],
    tip: "Add tables and bottle service from the event page after you create it.",
  },
  {
    id: "amapiano-day-party",
    emoji: "☀️",
    name: "Amapiano day party",
    blurb: "Sunday afternoon into the evening. Early, general, late entry.",
    title: "Amapiano Day Party",
    description:
      "Log drums in the sun. Amapiano from 3pm till late — rooftop vibes, food on site, come early for the early-bird price.",
    event_type: "music",
    community: "pan_african",
    primary_language: "mixed",
    genre: "amapiano",
    refund_policy: "none",
    capacity: 250,
    referral_off: 5,
    tiers: [
      { name: "Early Bird", price: 20, qty: 80 },
      { name: "General", price: 30, qty: 150 },
      { name: "Late Entry", price: 40, qty: 20 },
    ],
  },
  {
    id: "nollywood-screening",
    emoji: "🎬",
    name: "Nollywood screening",
    blurb: "A film night with seats to fill. Refundable up to a week before.",
    title: "Nollywood Screening Night",
    description:
      "A Nollywood premiere on the big screen, with the room to laugh and shout at it. Doors 6:30pm, film 7pm, Q&A after. Snacks and drinks available.",
    event_type: "film",
    community: "nigerian",
    primary_language: "english",
    genre: "nollywood",
    refund_policy: "7day",
    capacity: 120,
    referral_off: 0,
    tiers: [
      { name: "General", price: 15, qty: 100 },
      { name: "Front Row", price: 25, qty: 20 },
    ],
  },
  {
    id: "owambe",
    emoji: "🥂",
    name: "Owambe",
    blurb: "The celebration — food, live band, aso ebi. Refundable up to a week before.",
    title: "Owambe Night",
    description:
      "Live band, jollof that slaps, and a dance floor that doesn’t stop. Aso ebi optional, energy mandatory. Doors 7pm.",
    event_type: "cultural",
    community: "nigerian",
    primary_language: "yoruba",
    genre: "fuji",
    refund_policy: "7day",
    capacity: 200,
    referral_off: 10,
    tiers: [
      { name: "Regular", price: 40, qty: 150 },
      { name: "VIP", price: 75, qty: 50 },
    ],
    tip: "Tables of 8–10 sell well for owambe — add them from the event page after creating.",
  },
  {
    id: "comedy-night",
    emoji: "🎤",
    name: "Comedy night",
    blurb: "Stand-up with a headliner and openers. General and front row.",
    title: "Comedy Night",
    description:
      "Stand-up from the funniest people in the diaspora. Doors 7pm, show 8pm. Two-drink minimum at the bar, no heckling unless it’s good.",
    event_type: "comedy",
    community: "pan_african",
    primary_language: "english",
    genre: "standup",
    refund_policy: "none",
    capacity: 150,
    referral_off: 5,
    tiers: [
      { name: "General", price: 20, qty: 120 },
      { name: "Front Row", price: 35, qty: 30 },
    ],
  },
  {
    id: "gospel-concert",
    emoji: "🙏",
    name: "Gospel concert",
    blurb: "A worship night or concert. Refundable anytime before.",
    title: "Gospel Night",
    description: "An evening of praise and live worship. Doors 6pm. Families welcome; children under 12 enter free with a paying adult.",
    event_type: "faith",
    community: "pan_african",
    primary_language: "english",
    genre: "gospel",
    refund_policy: "anytime",
    capacity: 300,
    referral_off: 0,
    tiers: [
      { name: "General", price: 10, qty: 250 },
      { name: "VIP", price: 30, qty: 50 },
    ],
  },
  {
    id: "free-rsvp",
    emoji: "🤝",
    name: "Free RSVP",
    blurb: "A meetup, a launch, a community gathering. Free tickets, a real guest list.",
    title: "Community Meetup",
    description:
      "Come through, meet the people, hear what’s next. Free — RSVP so we know how many chairs to put out. Your ticket is your QR at the door.",
    event_type: "cultural",
    community: "pan_african",
    primary_language: "english",
    genre: "other",
    refund_policy: "none",
    capacity: 100,
    referral_off: 0,
    tiers: [{ name: "RSVP", price: 0, qty: 100 }],
    tip: "Free tickets need no payout setup — you can publish this right now.",
  },
  {
    id: "business-mixer",
    emoji: "💼",
    name: "Business mixer",
    blurb: "Networking or a conference. Early and standard pricing.",
    title: "Diaspora Business Mixer",
    description:
      "An evening for founders, professionals and creatives across the diaspora. Short talks, long conversations, drinks included with your ticket.",
    event_type: "conference",
    community: "pan_african",
    primary_language: "english",
    genre: "other",
    refund_policy: "7day",
    capacity: 120,
    referral_off: 0,
    tiers: [
      { name: "Early", price: 25, qty: 60 },
      { name: "Standard", price: 35, qty: 60 },
    ],
  },
];

export function findTemplate(id: string | null | undefined): EventTemplate | null {
  if (!id) return null;
  return EVENT_TEMPLATES.find((t) => t.id === id) ?? null;
}
