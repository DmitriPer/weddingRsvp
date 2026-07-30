-- Wedding RSVP — initial schema
-- PRD §5. Five tables. Every attending person is a row in `attendees`;
-- there are no headcount columns anywhere (PRD §5.1).
--
-- RLS is deny-all on every table. Nothing reaches the database except through
-- server code holding the service-role key (PRD §7.2).

-- ---------------------------------------------------------------------------
-- tables (seating) — declared first: attendees references it
-- ---------------------------------------------------------------------------
create table if not exists tables (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  capacity   int  not null check (capacity > 0),
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- invites — one row per invitation
-- ---------------------------------------------------------------------------
create table if not exists invites (
  id     uuid primary key default gen_random_uuid(),
  token  uuid unique not null default gen_random_uuid(),
  name   text not null,
  phone  text,

  status text not null default 'added'
         check (status in ('added','pending','opened','submitted','edited')),

  side     text check (side     in ('bride','groom','shared')),
  relation text check (relation in ('family','friend','work','invited_by_family')),

  -- outreach tracking (admin -> guest). Only a wa.me tap moves these (PRD §6.10).
  last_contacted_at timestamptz,
  contact_attempts  int not null default 0 check (contact_attempts >= 0),

  -- their answer. No separate `responses` table: strictly 1:1 with the invite.
  attending    boolean,      -- null = has not answered yet
  responded_at timestamptz,  -- first submission
  updated_at   timestamptz,  -- most recent change

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- attendees — the ONLY place people exist.
-- Admin-named people and guest-added "+1"s are the same shape; is_placeholder
-- distinguishes them so the admin can rename a +1 later (PRD §5.3).
-- ---------------------------------------------------------------------------
create table if not exists attendees (
  id             uuid primary key default gen_random_uuid(),
  invite_id      uuid not null references invites(id) on delete cascade,
  name           text not null,
  is_child       boolean not null default false,
  is_attending   boolean not null default false,
  is_placeholder boolean not null default false,

  -- seating: one person sits at one table, so this is a column, not a join
  -- table. Deleting a table unseats its people rather than deleting them.
  table_id uuid references tables(id) on delete set null,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- response_history — append-only. Never updated, never deleted.
-- Counts are snapshotted here because this is a record of what was true at
-- submission time; everywhere else headcount is derived (PRD §5.1).
-- ---------------------------------------------------------------------------
create table if not exists response_history (
  id           uuid primary key default gen_random_uuid(),
  invite_id    uuid not null references invites(id) on delete cascade,
  attending    boolean not null,
  adult_count  int not null default 0 check (adult_count >= 0),
  kid_count    int not null default 0 check (kid_count   >= 0),
  submitted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- wedding_config — exactly one row, enforced by singleton_guard.
-- Seeded in 002 so no screen can ever hit a missing row.
-- ---------------------------------------------------------------------------
create table if not exists wedding_config (
  id boolean primary key default true check (id),  -- only `true` is valid => at most one row

  couple_names      text not null default '',
  wedding_date_time timestamptz,
  venue_name        text not null default '',

  rsvp_deadline timestamptz,          -- null = no deadline, form always open
  contact_phone text not null default '',

  invite_message_template    text not null default '',
  day_of_message_template    text not null default '',
  thank_you_message_template text not null default '',

  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes — on the columns actually filtered and joined by
-- ---------------------------------------------------------------------------
create index if not exists idx_invites_status         on invites(status);
create index if not exists idx_attendees_invite       on attendees(invite_id);
create index if not exists idx_attendees_table        on attendees(table_id);
create index if not exists idx_history_invite         on response_history(invite_id);
create index if not exists idx_history_submitted      on response_history(submitted_at desc);
create index if not exists idx_tables_sort            on tables(sort_order);
-- invites.token needs no index: `unique` creates one.

-- ---------------------------------------------------------------------------
-- RLS: deny all. The anon key ships to browsers by design; this makes it
-- powerless. Every operation goes through the service role in an API route.
-- ---------------------------------------------------------------------------
alter table invites          enable row level security;
alter table attendees        enable row level security;
alter table response_history enable row level security;
alter table wedding_config   enable row level security;
alter table tables           enable row level security;

drop policy if exists "deny_all" on invites;
create policy "deny_all" on invites          for all using (false);
drop policy if exists "deny_all" on attendees;
create policy "deny_all" on attendees        for all using (false);
drop policy if exists "deny_all" on response_history;
create policy "deny_all" on response_history for all using (false);
drop policy if exists "deny_all" on wedding_config;
create policy "deny_all" on wedding_config   for all using (false);
drop policy if exists "deny_all" on tables;
create policy "deny_all" on tables           for all using (false);
