-- Hotties That Hit: Match Journal, Court Notes, Court Ratings, Social Graph.
-- Run once against the shared Supabase project (after schema.sql, profiles.sql,
-- favorites.sql, and open_play.sql).

-- =============================================================================
-- 1. MATCH JOURNAL
-- One row per (user, open_play_event) once the event is in the past.
-- Auto-backfilled by the /api/journal endpoint for any past event the user
-- hosted or joined.  A user can also create freeform entries with no event_id.
-- =============================================================================

create table if not exists hotties.journal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references hotties.profiles(id) on delete cascade,
  event_id uuid references hotties.open_play_events(id) on delete set null,
  facility_id uuid references hotties.facilities(id) on delete set null,
  played_at timestamptz not null,

  -- Quick dropdowns. All optional so the entry is usable the moment it's auto-created.
  won boolean,                                   -- Win/Lost (Y/N)
  how_i_played text,                             -- 'great' | 'good' | 'ok' | 'off'
  opponents_played text,                         -- same vocabulary as above
  strongest_shot text,                           -- 'forehand' | 'backhand' | 'serve' | 'volley' | 'return' | 'overhead' | 'slice' | 'dropshot' | 'movement' | 'mental'
  work_on text,                                  -- same vocabulary as strongest_shot

  -- Free-form notes.
  notes text,

  -- Snapshot of weather at the played_at time, captured once and frozen here.
  weather jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, event_id),
  constraint journal_how_played_valid check (
    how_i_played is null or how_i_played in ('great','good','ok','off')
  ),
  constraint journal_opp_played_valid check (
    opponents_played is null or opponents_played in ('great','good','ok','off')
  ),
  constraint journal_shot_valid check (
    strongest_shot is null or strongest_shot in
      ('forehand','backhand','serve','volley','return','overhead','slice','dropshot','movement','mental')
  ),
  constraint journal_work_valid check (
    work_on is null or work_on in
      ('forehand','backhand','serve','volley','return','overhead','slice','dropshot','movement','mental')
  ),
  constraint journal_notes_len check (notes is null or char_length(notes) <= 4000)
);

create index if not exists journal_user_played_idx on hotties.journal_entries (user_id, played_at desc);
create index if not exists journal_event_idx on hotties.journal_entries (event_id);

drop trigger if exists journal_set_updated_at on hotties.journal_entries;
create trigger journal_set_updated_at
before update on hotties.journal_entries
for each row execute function hotties.set_updated_at();

alter table hotties.journal_entries enable row level security;

-- A journal entry is private to its owner.
drop policy if exists "journal_select_own" on hotties.journal_entries;
create policy "journal_select_own" on hotties.journal_entries
  for select using (auth.uid() = user_id or hotties.is_admin(auth.uid()));

drop policy if exists "journal_insert_own" on hotties.journal_entries;
create policy "journal_insert_own" on hotties.journal_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "journal_update_own" on hotties.journal_entries;
create policy "journal_update_own" on hotties.journal_entries
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "journal_delete_own" on hotties.journal_entries;
create policy "journal_delete_own" on hotties.journal_entries
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on hotties.journal_entries to authenticated;
grant all on hotties.journal_entries to service_role;


-- =============================================================================
-- 2. COURT NOTES (admin-moderated)
-- Anyone signed in can submit a note about a facility.  Admin reviews, edits,
-- and approves.  Approved notes are public.
-- =============================================================================

create table if not exists hotties.court_notes (
  id uuid primary key default uuid_generate_v4(),
  facility_id uuid not null references hotties.facilities(id) on delete cascade,
  author_id uuid references hotties.profiles(id) on delete set null,
  body text not null,
  status text not null default 'pending',     -- 'pending' | 'approved' | 'rejected'
  approved_by uuid references hotties.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint court_notes_status_valid check (status in ('pending','approved','rejected')),
  constraint court_notes_body_len check (char_length(body) between 1 and 1000)
);

create index if not exists court_notes_facility_status_idx
  on hotties.court_notes (facility_id, status, created_at desc);
create index if not exists court_notes_pending_idx
  on hotties.court_notes (status, created_at) where status = 'pending';

drop trigger if exists court_notes_set_updated_at on hotties.court_notes;
create trigger court_notes_set_updated_at
before update on hotties.court_notes
for each row execute function hotties.set_updated_at();

alter table hotties.court_notes enable row level security;

-- Anyone can read APPROVED notes.  Authors can read their own pending notes.
drop policy if exists "court_notes_select_approved_or_own" on hotties.court_notes;
create policy "court_notes_select_approved_or_own" on hotties.court_notes
  for select using (
    status = 'approved'
    or auth.uid() = author_id
    or hotties.is_admin(auth.uid())
  );

-- Authenticated users can submit a note as themselves; status forced to pending.
drop policy if exists "court_notes_insert_own_pending" on hotties.court_notes;
create policy "court_notes_insert_own_pending" on hotties.court_notes
  for insert to authenticated
  with check (auth.uid() = author_id and status = 'pending');

-- Only admins can update / approve / delete.
drop policy if exists "court_notes_admin_update" on hotties.court_notes;
create policy "court_notes_admin_update" on hotties.court_notes
  for update using (hotties.is_admin(auth.uid()))
  with check (hotties.is_admin(auth.uid()));

drop policy if exists "court_notes_admin_delete" on hotties.court_notes;
create policy "court_notes_admin_delete" on hotties.court_notes
  for delete using (hotties.is_admin(auth.uid()));

grant select, insert on hotties.court_notes to authenticated;
grant select on hotties.court_notes to anon;
grant all on hotties.court_notes to service_role;

-- Public view: just the approved notes, no internal columns.
create or replace view hotties.court_notes_approved as
  select id, facility_id, body, approved_at, created_at
  from hotties.court_notes
  where status = 'approved';

grant select on hotties.court_notes_approved to anon, authenticated, service_role;


-- =============================================================================
-- 3. COURT RATINGS (1-5 stars, no approval)
-- One row per (user, facility); user can upsert their rating any time.
-- =============================================================================

create table if not exists hotties.court_ratings (
  user_id uuid not null references hotties.profiles(id) on delete cascade,
  facility_id uuid not null references hotties.facilities(id) on delete cascade,
  stars int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, facility_id),
  constraint court_ratings_range check (stars between 1 and 5)
);

create index if not exists court_ratings_facility_idx on hotties.court_ratings (facility_id);

drop trigger if exists court_ratings_set_updated_at on hotties.court_ratings;
create trigger court_ratings_set_updated_at
before update on hotties.court_ratings
for each row execute function hotties.set_updated_at();

alter table hotties.court_ratings enable row level security;

drop policy if exists "court_ratings_select_all" on hotties.court_ratings;
create policy "court_ratings_select_all" on hotties.court_ratings
  for select using (true);

drop policy if exists "court_ratings_upsert_own" on hotties.court_ratings;
create policy "court_ratings_upsert_own" on hotties.court_ratings
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "court_ratings_update_own" on hotties.court_ratings;
create policy "court_ratings_update_own" on hotties.court_ratings
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "court_ratings_delete_own" on hotties.court_ratings;
create policy "court_ratings_delete_own" on hotties.court_ratings
  for delete using (auth.uid() = user_id);

grant select on hotties.court_ratings to anon, authenticated;
grant insert, update, delete on hotties.court_ratings to authenticated;
grant all on hotties.court_ratings to service_role;

create or replace view hotties.facility_rating_summary as
  select facility_id,
         round(avg(stars)::numeric, 2) as avg_stars,
         count(*)::int                 as rating_count
  from hotties.court_ratings
  group by facility_id;

grant select on hotties.facility_rating_summary to anon, authenticated, service_role;


-- =============================================================================
-- 4. SOCIAL GRAPH — follows
-- =============================================================================

create table if not exists hotties.follows (
  follower_id uuid not null references hotties.profiles(id) on delete cascade,
  following_id uuid not null references hotties.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on hotties.follows (following_id, created_at desc);
create index if not exists follows_follower_idx  on hotties.follows (follower_id, created_at desc);

alter table hotties.follows enable row level security;

drop policy if exists "follows_select_all" on hotties.follows;
create policy "follows_select_all" on hotties.follows
  for select using (true);

drop policy if exists "follows_insert_own" on hotties.follows;
create policy "follows_insert_own" on hotties.follows
  for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on hotties.follows;
create policy "follows_delete_own" on hotties.follows
  for delete to authenticated
  using (auth.uid() = follower_id);

grant select on hotties.follows to anon, authenticated;
grant insert, delete on hotties.follows to authenticated;
grant all on hotties.follows to service_role;


-- =============================================================================
-- 5. AVAILABILITY PINGS ("I'm free Saturday at McCarren, who's in?")
-- Posted by a user; visible in followers' feeds.
-- =============================================================================

create table if not exists hotties.availability_pings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references hotties.profiles(id) on delete cascade,
  facility_id uuid references hotties.facilities(id) on delete set null,
  starts_at timestamptz not null,
  ends_at   timestamptz,
  message text,
  created_at timestamptz not null default now(),

  constraint pings_message_len check (message is null or char_length(message) <= 500),
  constraint pings_times_ordered check (ends_at is null or ends_at > starts_at)
);

create index if not exists pings_user_idx on hotties.availability_pings (user_id, starts_at desc);
create index if not exists pings_starts_idx on hotties.availability_pings (starts_at desc);

alter table hotties.availability_pings enable row level security;

drop policy if exists "pings_select_all" on hotties.availability_pings;
create policy "pings_select_all" on hotties.availability_pings
  for select using (true);

drop policy if exists "pings_insert_own" on hotties.availability_pings;
create policy "pings_insert_own" on hotties.availability_pings
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pings_delete_own" on hotties.availability_pings;
create policy "pings_delete_own" on hotties.availability_pings
  for delete to authenticated
  using (auth.uid() = user_id or hotties.is_admin(auth.uid()));

grant select on hotties.availability_pings to anon, authenticated;
grant insert, delete on hotties.availability_pings to authenticated;
grant all on hotties.availability_pings to service_role;


-- =============================================================================
-- 6. HITTING PARTNERS view — derived from shared open-play participation.
-- For each (user, partner) pair we count the number of past events they
-- BOTH participated in.  Used by /api/social/partners.
-- =============================================================================

create or replace view hotties.hitting_partners as
  select
    a.user_id                          as user_id,
    b.user_id                          as partner_id,
    count(*)::int                      as sessions_together,
    max(e.start_time)                  as last_played_at
  from hotties.open_play_participants a
  join hotties.open_play_participants b
    on a.event_id = b.event_id
   and a.user_id <> b.user_id
  join hotties.open_play_events e
    on e.id = a.event_id
   and e.status <> 'cancelled'
   and e.end_time < now()
  group by a.user_id, b.user_id;

grant select on hotties.hitting_partners to anon, authenticated, service_role;
