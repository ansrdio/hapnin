-- ============================================================
-- Hapnin — 001_initial_schema
-- Postgres / Supabase
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================
-- ENUMS — the vocabulary. Adding values later is easy;
-- changing meaning after data exists is not. Get these right.
-- ============================================================

create type event_status     as enum ('draft','on_sale','sold_out','past','cancelled');
create type event_type       as enum ('music','film','comedy','cultural','nightlife','food','faith','conference');
create type community        as enum ('nigerian','ghanaian','pan_african','francophone','east_african','caribbean','other');
create type language_code    as enum ('english','pidgin','yoruba','igbo','hausa','french','swahili','mixed');
create type genre            as enum ('afrobeats','amapiano','highlife','gospel','hip_hop','alte','fuji','nollywood','documentary','standup','other');

create type layout_kind      as enum ('ga','zoned','seated');
create type zone_kind        as enum ('table','section','standing');
create type zone_shape       as enum ('round','rect','block');

create type order_status     as enum ('pending','paid','refunded','failed');
create type referral_source  as enum ('instagram','whatsapp','friend','organizer','search','flyer','door','other');
create type sale_channel     as enum ('online','door','comp','transfer');

create type message_kind     as enum ('transactional','marketing');
create type message_channel  as enum ('sms','email','both');
create type message_status   as enum ('draft','queued','sending','sent','failed');
create type delivery_status  as enum ('queued','sent','delivered','failed','bounced','opted_out');

create type consent_scope    as enum ('hapnin','organizer_events');
create type consent_channel  as enum ('sms','email');
create type consent_action   as enum ('granted','revoked');
create type consent_source   as enum ('checkout','sms_stop','email_unsubscribe','admin','transfer');

-- ============================================================
-- ORGANIZERS
-- ============================================================

create table organizers (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid unique,                    -- supabase auth.users.id
  name                text not null,
  handle              citext unique not null,         -- /o/{handle}
  instagram_handle    text,
  email               citext not null,
  phone               text not null,
  stripe_account_id   text unique,                    -- Connect Express
  stripe_onboarded    boolean not null default false,
  marketing_approved  boolean not null default false, -- admin gate on first blast
  created_at          timestamptz not null default now()
);

-- ============================================================
-- VENUES / ZONES  (v1.5 — created now so v1 needs no migration)
-- ============================================================

create table venues (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid references organizers(id) on delete set null,
  name              text not null,
  address           text,
  city              text,
  state             text,
  postal_code       text,
  default_capacity  int,
  layout_kind       layout_kind not null default 'ga',
  created_at        timestamptz not null default now()
);

create table zones (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references venues(id) on delete cascade,
  name         text not null,
  kind         zone_kind not null,
  seat_count   int,                        -- 8 for a table, null for open standing
  position_x   numeric,
  position_y   numeric,
  shape        zone_shape,
  sort_order   int not null default 0
);

create index zones_venue_idx on zones (venue_id, sort_order);

-- `seats` (per-seat assignment) is deliberately NOT created here.
-- It arrives with cinema screenings, via integration. See spec §9 Tier 3.

-- ============================================================
-- EVENTS
-- ============================================================

create table events (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid not null references organizers(id) on delete restrict,
  venue_id          uuid references venues(id) on delete set null,

  title             text not null,
  slug              citext unique not null,          -- hapnin.now/e/{slug}
  description       text,
  flyer_url         text,

  venue_name        text not null,                   -- denormalised: venues are v1.5
  venue_address     text not null,
  city              text not null,
  state             text not null,

  starts_at         timestamptz not null,
  doors_at          timestamptz,
  timezone          text not null default 'America/Phoenix',

  status            event_status not null default 'draft',
  capacity          int,

  -- THE VOCABULARY FIELDS. Dropdowns only. This is what lets the
  -- abroad data join to the home-side records later.
  event_type        event_type not null,
  community         community not null,
  primary_language  language_code not null,
  genre             genre not null,
  talent            text[] not null default '{}',    -- canonical names, autocompleted

  on_sale_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index events_organizer_idx on events (organizer_id, starts_at desc);
create index events_status_idx    on events (status, starts_at);
create index events_talent_idx    on events using gin (talent);

-- Canonical talent list, so "Burna Boy" / "burna boy" / "Burnaboy"
-- resolve to one string. Autocomplete reads from here.
create table talent_canonical (
  name        text primary key,
  use_count   int not null default 0
);

-- ============================================================
-- TICKET TIERS
-- ============================================================

create table ticket_tiers (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  zone_id         uuid references zones(id) on delete set null,  -- null = GA
  name            text not null,
  price_cents     int not null check (price_cents >= 0),
  quantity_total  int not null check (quantity_total > 0),
  quantity_sold   int not null default 0 check (quantity_sold >= 0),
  sales_start_at  timestamptz,
  sales_end_at    timestamptz,
  is_active       boolean not null default true,
  sort_order      int not null default 0,

  constraint tier_not_oversold check (quantity_sold <= quantity_total)
);

create index tiers_event_idx on ticket_tiers (event_id, sort_order);

-- ============================================================
-- BUYERS  — keyed on PHONE, not email.
-- One person, three email addresses, one phone number.
-- Cross-event repeat tracking is the whole thesis; it dies on email.
-- ============================================================

create table buyers (
  id                      uuid primary key default gen_random_uuid(),
  phone                   text unique not null,        -- E.164, normalise before insert
  email                   citext,
  first_name              text,
  last_name               text,
  postal_code             text not null,               -- the catchment map
  city                    text,
  state                   text,

  sms_marketing_opt_in    boolean not null default false,
  email_marketing_opt_in  boolean not null default false,
  sms_opted_out_at        timestamptz,
  email_opted_out_at      timestamptz,

  screening_interest      boolean,                     -- null = not asked / no answer
  first_event_id          uuid references events(id) on delete set null,
  created_at              timestamptz not null default now()
);

create index buyers_postal_idx      on buyers (postal_code);
create index buyers_first_event_idx on buyers (first_event_id);

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id                        uuid primary key default gen_random_uuid(),
  event_id                  uuid not null references events(id) on delete restrict,
  buyer_id                  uuid not null references buyers(id) on delete restrict,
  tier_id                   uuid not null references ticket_tiers(id) on delete restrict,

  quantity                  int not null check (quantity > 0),
  subtotal_cents            int not null,
  fee_cents                 int not null default 0,
  total_cents               int not null,

  stripe_payment_intent_id  text unique,
  status                    order_status not null default 'pending',
  channel                   sale_channel not null default 'online',

  -- SIGNAL FIELDS — written at purchase, never derived later.
  days_before_event         int,
  referral_source           referral_source,

  created_at                timestamptz not null default now()
);

create index orders_event_idx  on orders (event_id, status);
create index orders_buyer_idx  on orders (buyer_id, created_at desc);

-- days_before_event must be frozen at purchase time.
-- Deriving it from timestamps later works until an event date moves,
-- and event dates move.
create or replace function set_days_before_event() returns trigger as $$
begin
  if new.days_before_event is null then
    select greatest(0, (e.starts_at::date - now()::date))
      into new.days_before_event
      from events e where e.id = new.event_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger orders_set_days_before
  before insert on orders
  for each row execute function set_days_before_event();

-- ============================================================
-- TICKETS — one row per admitted person, not per order.
-- ============================================================

create table tickets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  buyer_id        uuid not null references buyers(id) on delete restrict, -- changes on transfer
  zone_id         uuid references zones(id) on delete set null,

  qr_token        text unique not null,        -- signed, not sequential
  is_comp         boolean not null default false,

  checked_in_at   timestamptz,
  checked_in_by   uuid references organizers(id) on delete set null,

  transferred_from_buyer_id uuid references buyers(id) on delete set null,
  transferred_at            timestamptz,

  created_at      timestamptz not null default now()
);

create index tickets_event_idx  on tickets (event_id, checked_in_at);
create index tickets_buyer_idx  on tickets (buyer_id);
create unique index tickets_qr_idx on tickets (qr_token);

-- ============================================================
-- WAITLIST — demand signal without a transaction
-- ============================================================

create table waitlist_entries (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  tier_id     uuid references ticket_tiers(id) on delete cascade,
  buyer_id    uuid not null references buyers(id) on delete cascade,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (event_id, buyer_id)
);

-- ============================================================
-- MESSAGING
-- ============================================================

create table messages (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid not null references organizers(id) on delete cascade,
  event_id          uuid references events(id) on delete cascade,  -- null = cross-event marketing
  kind              message_kind not null,
  channel           message_channel not null,
  subject           text,
  body              text not null,
  recipient_filter  jsonb not null default '{}',
  status            message_status not null default 'draft',
  scheduled_for     timestamptz,
  sent_at           timestamptz,
  recipient_count   int not null default 0,
  created_at        timestamptz not null default now()
);

create index messages_organizer_idx on messages (organizer_id, created_at desc);

create table message_recipients (
  id                   uuid primary key default gen_random_uuid(),
  message_id           uuid not null references messages(id) on delete cascade,
  buyer_id             uuid not null references buyers(id) on delete cascade,
  channel              consent_channel not null,
  provider_message_id  text,
  status               delivery_status not null default 'queued',
  error                text,
  delivered_at         timestamptz,
  unique (message_id, buyer_id, channel)
);

create index msg_recipients_status_idx on message_recipients (message_id, status);

-- ============================================================
-- CONSENT LOG — append only.
-- consent_text is stored VERBATIM. A TCPA defence rests on proving
-- exactly what the buyer agreed to, on what date, from what IP.
-- A pointer to "the current checkout copy" is worthless once edited.
-- ============================================================

create table consent_log (
  id            uuid primary key default gen_random_uuid(),
  buyer_id      uuid not null references buyers(id) on delete cascade,
  scope         consent_scope not null,
  channel       consent_channel not null,
  action        consent_action not null,
  source        consent_source not null,
  event_id      uuid references events(id) on delete set null,
  ip_address    inet,
  user_agent    text,
  consent_text  text not null,
  created_at    timestamptz not null default now()
);

create index consent_buyer_idx on consent_log (buyer_id, created_at desc);

create rule consent_log_no_update as on update to consent_log do instead nothing;
create rule consent_log_no_delete as on delete to consent_log do instead nothing;

-- ============================================================
-- INVENTORY — atomic reservation. Never read-then-write.
-- ============================================================

create or replace function reserve_tier_inventory(p_tier_id uuid, p_qty int)
returns void as $$
declare
  updated int;
begin
  update ticket_tiers
     set quantity_sold = quantity_sold + p_qty
   where id = p_tier_id
     and is_active
     and quantity_sold + p_qty <= quantity_total;

  get diagnostics updated = row_count;

  if updated = 0 then
    raise exception 'SOLD_OUT' using errcode = 'check_violation';
  end if;
end;
$$ language plpgsql;

create or replace function release_tier_inventory(p_tier_id uuid, p_qty int)
returns void as $$
begin
  update ticket_tiers
     set quantity_sold = greatest(0, quantity_sold - p_qty)
   where id = p_tier_id;
end;
$$ language plpgsql;

-- ============================================================
-- ADMIN VIEW — the kill/continue metric.
-- % of a given event's buyers who bought again at ANY later event,
-- including events by a different organizer. If this doesn't
-- compound, the map doesn't exist.
-- ============================================================

create or replace view event_repeat_rate as
select
  e.id                as event_id,
  e.title,
  e.starts_at,
  count(distinct o.buyer_id)                                  as buyers,
  count(distinct o2.buyer_id)                                 as returning_buyers,
  round(100.0 * count(distinct o2.buyer_id)
        / nullif(count(distinct o.buyer_id), 0), 1)           as repeat_pct
from events e
join orders o
  on o.event_id = e.id and o.status = 'paid'
left join orders o2
  on o2.buyer_id = o.buyer_id
 and o2.status = 'paid'
 and o2.created_at > o.created_at
 and o2.event_id <> e.id
group by e.id, e.title, e.starts_at;

-- ============================================================
-- ROW LEVEL SECURITY
-- Buyers never authenticate. Public reads go through the service
-- role in server-side route handlers only.
-- ============================================================

alter table organizers  enable row level security;
alter table events      enable row level security;
alter table ticket_tiers enable row level security;
alter table orders      enable row level security;
alter table tickets     enable row level security;
alter table messages    enable row level security;
alter table buyers      enable row level security;
alter table consent_log enable row level security;

create policy org_self on organizers
  for all using (auth_user_id = auth.uid());

create policy org_events on events
  for all using (
    organizer_id in (select id from organizers where auth_user_id = auth.uid())
  );

create policy org_tiers on ticket_tiers
  for all using (
    event_id in (
      select e.id from events e
      join organizers g on g.id = e.organizer_id
      where g.auth_user_id = auth.uid()
    )
  );

create policy org_orders on orders
  for select using (
    event_id in (
      select e.id from events e
      join organizers g on g.id = e.organizer_id
      where g.auth_user_id = auth.uid()
    )
  );

create policy org_tickets on tickets
  for all using (
    event_id in (
      select e.id from events e
      join organizers g on g.id = e.organizer_id
      where g.auth_user_id = auth.uid()
    )
  );

create policy org_messages on messages
  for all using (
    organizer_id in (select id from organizers where auth_user_id = auth.uid())
  );

-- Buyers and consent_log: no organizer-facing policy.
-- Cross-organizer buyer history is YOUR asset, reachable only
-- through the service role in admin routes.
