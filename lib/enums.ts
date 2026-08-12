// The vocabulary. Ported verbatim from 001_hapnin_schema.sql — in Postgres these
// were `create type … as enum`; on Firestore they're validated string constants.
// Adding a value later is easy; changing an existing value's meaning after data
// exists is not. These are the dropdown sources, and there is no free-text escape.
//
// Every server write that sets one of these fields MUST validate against the
// matching array here before the document is written.

export const EVENT_STATUS = ["draft", "on_sale", "sold_out", "past", "cancelled"] as const;
export const EVENT_TYPE = ["music", "film", "comedy", "cultural", "nightlife", "food", "faith", "conference"] as const;
export const COMMUNITY = ["nigerian", "ghanaian", "pan_african", "francophone", "east_african", "caribbean", "other"] as const;
export const LANGUAGE_CODE = ["english", "pidgin", "yoruba", "igbo", "hausa", "french", "swahili", "mixed"] as const;
export const GENRE = ["afrobeats", "amapiano", "highlife", "gospel", "hip_hop", "alte", "fuji", "nollywood", "documentary", "standup", "other"] as const;

export const LAYOUT_KIND = ["ga", "zoned", "seated"] as const;
export const ZONE_KIND = ["table", "section", "standing"] as const;
export const ZONE_SHAPE = ["round", "rect", "block"] as const;

export const ORDER_STATUS = ["pending", "paid", "refunded", "failed"] as const;
export const REFERRAL_SOURCE = ["instagram", "whatsapp", "friend", "organizer", "search", "flyer", "door", "other"] as const;
export const SALE_CHANNEL = ["online", "door", "comp", "transfer"] as const;

export const MESSAGE_KIND = ["transactional", "marketing"] as const;
export const MESSAGE_CHANNEL = ["sms", "email", "both"] as const;
export const MESSAGE_STATUS = ["draft", "queued", "sending", "sent", "failed"] as const;
export const DELIVERY_STATUS = ["queued", "sent", "delivered", "failed", "bounced", "opted_out"] as const;

export const CONSENT_SCOPE = ["hapnin", "organizer_events"] as const;
export const CONSENT_CHANNEL = ["sms", "email"] as const;
export const CONSENT_ACTION = ["granted", "revoked"] as const;
export const CONSENT_SOURCE = ["checkout", "sms_stop", "email_unsubscribe", "admin", "transfer"] as const;

// Team roles — from the (missing) 002 migration; modelled here directly.
export const TEAM_ROLE = ["manager", "door"] as const;

export type EventStatus = (typeof EVENT_STATUS)[number];
export type EventType = (typeof EVENT_TYPE)[number];
export type Community = (typeof COMMUNITY)[number];
export type LanguageCode = (typeof LANGUAGE_CODE)[number];
export type Genre = (typeof GENRE)[number];
export type LayoutKind = (typeof LAYOUT_KIND)[number];
export type ZoneKind = (typeof ZONE_KIND)[number];
export type ZoneShape = (typeof ZONE_SHAPE)[number];
export type OrderStatus = (typeof ORDER_STATUS)[number];
export type ReferralSource = (typeof REFERRAL_SOURCE)[number];
export type SaleChannel = (typeof SALE_CHANNEL)[number];
export type MessageKind = (typeof MESSAGE_KIND)[number];
export type MessageChannel = (typeof MESSAGE_CHANNEL)[number];
export type MessageStatus = (typeof MESSAGE_STATUS)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];
export type ConsentScope = (typeof CONSENT_SCOPE)[number];
export type ConsentChannel = (typeof CONSENT_CHANNEL)[number];
export type ConsentAction = (typeof CONSENT_ACTION)[number];
export type ConsentSource = (typeof CONSENT_SOURCE)[number];
export type TeamRole = (typeof TEAM_ROLE)[number];

/** Runtime guard for any write that sets an enum field. */
export function isOneOf<T extends readonly string[]>(allowed: T, v: unknown): v is T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}
