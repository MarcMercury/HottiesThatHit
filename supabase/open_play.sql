-- Hotties That Hit: Open Play events.
-- A user can post a match they've set up (court reserved or planning to reserve)
-- and other users can claim one of the open spots.
--
-- Run once against the shared Supabase project (after schema.sql / profiles.sql).

-- ---------- open_play_events ----------
create table if not exists hotties.open_play_events (
  id uuid primary key default uuid_generate_v4(),
  host_id uuid not null references hotties.profiles(id) on delete cascade,

  facility_id uuid not null references hotties.facilities(id) on delete restrict,
  court_number text,

  start_time timestamptz not null,
  end_time timestamptz not null,

  -- Total number of player spots (including the host). 2..16.
  total_spots int not null,

  -- Skill level range (NTRP). Both optional but recommended.
  min_ntrp numeric(2,1),
  max_ntrp numeric(2,1),

  title text,
  notes text,

  -- 'open' | 'full' | 'cancelled' | 'completed'
  -- We recompute status in the API but store it for cheap filtering.
  status text not null default 'open',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint open_play_times_ordered check (end_time > start_time),
  constraint open_play_spots_range check (total_spots between 2 and 16),
  constraint open_play_ntrp_range check (
    (min_ntrp is null or (min_ntrp >= 1.0 and min_ntrp <= 7.0 and (min_ntrp * 2) = floor(min_ntrp * 2)))
    and (max_ntrp is null or (max_ntrp >= 1.0 and max_ntrp <= 7.0 and (max_ntrp * 2) = floor(max_ntrp * 2)))
    and (min_ntrp is null or max_ntrp is null or max_ntrp >= min_ntrp)
  ),
  constraint open_play_status_valid check (status in ('open','full','cancelled','completed')),
  constraint open_play_notes_len check (notes is null or char_length(notes) <= 1000),
  constraint open_play_title_len check (title is null or char_length(title) <= 120)
);

create index if not exists open_play_start_idx on hotties.open_play_events (start_time);
create index if not exists open_play_status_idx on hotties.open_play_events (status, start_time);
create index if not exists open_play_host_idx on hotties.open_play_events (host_id);
create index if not exists open_play_facility_idx on hotties.open_play_events (facility_id);

drop trigger if exists open_play_set_updated_at on hotties.open_play_events;
create trigger open_play_set_updated_at
before update on hotties.open_play_events
for each row execute function hotties.set_updated_at();

-- ---------- open_play_participants ----------
-- One row per claimed spot. The host is auto-inserted on event creation.
create table if not exists hotties.open_play_participants (
  event_id uuid not null references hotties.open_play_events(id) on delete cascade,
  user_id  uuid not null references hotties.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  is_host boolean not null default false,
  primary key (event_id, user_id)
);

create index if not exists open_play_participants_user_idx
  on hotties.open_play_participants (user_id);

-- ---------- RLS ----------
alter table hotties.open_play_events enable row level security;
alter table hotties.open_play_participants enable row level security;

-- Anyone can read events.
drop policy if exists "open_play_select_all" on hotties.open_play_events;
create policy "open_play_select_all" on hotties.open_play_events
  for select using (true);

-- Authenticated users can create events they host.
drop policy if exists "open_play_insert_own" on hotties.open_play_events;
create policy "open_play_insert_own" on hotties.open_play_events
  for insert to authenticated
  with check (auth.uid() = host_id);

-- Hosts can update/delete their own events; admins can do anything.
drop policy if exists "open_play_update_own" on hotties.open_play_events;
create policy "open_play_update_own" on hotties.open_play_events
  for update to authenticated
  using (auth.uid() = host_id or hotties.is_admin(auth.uid()))
  with check (auth.uid() = host_id or hotties.is_admin(auth.uid()));

drop policy if exists "open_play_delete_own" on hotties.open_play_events;
create policy "open_play_delete_own" on hotties.open_play_events
  for delete to authenticated
  using (auth.uid() = host_id or hotties.is_admin(auth.uid()));

-- Participants: readable by anyone; users manage their own row; host can remove anyone.
drop policy if exists "open_play_participants_select_all" on hotties.open_play_participants;
create policy "open_play_participants_select_all" on hotties.open_play_participants
  for select using (true);

drop policy if exists "open_play_participants_insert_self" on hotties.open_play_participants;
create policy "open_play_participants_insert_self" on hotties.open_play_participants
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "open_play_participants_delete_self_or_host" on hotties.open_play_participants;
create policy "open_play_participants_delete_self_or_host" on hotties.open_play_participants
  for delete to authenticated
  using (
    auth.uid() = user_id
    or hotties.is_admin(auth.uid())
    or exists (
      select 1 from hotties.open_play_events e
      where e.id = event_id and e.host_id = auth.uid()
    )
  );

-- ---------- Grants ----------
grant select on hotties.open_play_events, hotties.open_play_participants to anon, authenticated;
grant insert, update, delete on hotties.open_play_events to authenticated;
grant insert, delete on hotties.open_play_participants to authenticated;
grant all on hotties.open_play_events, hotties.open_play_participants to service_role;
