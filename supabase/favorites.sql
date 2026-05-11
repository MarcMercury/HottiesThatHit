-- Hotties That Hit: per-user favorite courts.
-- Each row = "user X saved facility Y to their favorites".
-- Run once against the shared Supabase project.

create table if not exists hotties.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references hotties.facilities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create index if not exists favorites_user_idx     on hotties.favorites (user_id, created_at desc);
create index if not exists favorites_facility_idx on hotties.favorites (facility_id);

-- ---------- RLS ----------
-- Favorites are semi-public: a logged-in user owns their list, but other users
-- (and anon visitors) can read which courts a player has saved. This mirrors
-- the public "/players/<username>" page and lets us show favorites there.
alter table hotties.favorites enable row level security;

drop policy if exists "favorites_select_all" on hotties.favorites;
create policy "favorites_select_all" on hotties.favorites
  for select using (true);

drop policy if exists "favorites_insert_own" on hotties.favorites;
create policy "favorites_insert_own" on hotties.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on hotties.favorites;
create policy "favorites_delete_own" on hotties.favorites
  for delete using (auth.uid() = user_id);

-- ---------- Aggregated favorite count per facility (anon-readable) ----------
-- Plain view; Supabase/PG 15+ runs it with the view-owner's privileges so RLS
-- on the underlying table does not restrict the anon role here.
create or replace view hotties.facility_favorite_counts as
  select facility_id, count(*)::int as favorite_count
  from hotties.favorites
  group by facility_id;

-- Grants (schema usage already granted in schema.sql)
grant select on hotties.favorites to anon, authenticated;
grant insert, delete on hotties.favorites to authenticated;
grant all on hotties.favorites to service_role;
grant select on hotties.facility_favorite_counts to anon, authenticated, service_role;
