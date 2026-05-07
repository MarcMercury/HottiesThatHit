-- Hotties That Hit: user profiles + admin role.
-- Auth is handled by Supabase Auth (auth.users). Profile data lives in hotties.profiles.
-- Run this once against the shared Supabase project.

-- ---------- profiles table ----------
create table if not exists hotties.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  ntrp_rating numeric(2,1),                  -- 1.0 .. 7.0 in 0.5 steps
  bio text,
  city text,
  image_url_1 text,
  image_url_2 text,
  image_url_3 text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (char_length(username) between 3 and 24
                                    and username ~ '^[a-z0-9_]+$'),
  constraint ntrp_range check (ntrp_rating is null
                               or (ntrp_rating >= 1.0 and ntrp_rating <= 7.0
                                   and (ntrp_rating * 2) = floor(ntrp_rating * 2)))
);

create index if not exists profiles_username_idx on hotties.profiles (username);
create index if not exists profiles_is_admin_idx on hotties.profiles (is_admin) where is_admin = true;

-- updated_at trigger
create or replace function hotties.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on hotties.profiles;
create trigger profiles_set_updated_at
before update on hotties.profiles
for each row execute function hotties.set_updated_at();

-- ---------- RLS ----------
alter table hotties.profiles enable row level security;

-- Anyone (incl. anon) can read public profile fields. We keep email out via the API,
-- but it's also fine here since we're not exposing this table directly to anon in the UI.
drop policy if exists "profiles_select_all" on hotties.profiles;
create policy "profiles_select_all" on hotties.profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on hotties.profiles;
create policy "profiles_insert_own" on hotties.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on hotties.profiles;
create policy "profiles_update_own" on hotties.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id
              -- non-admins cannot grant themselves admin
              and is_admin = (select is_admin from hotties.profiles p where p.id = auth.uid()));

-- Admins can do anything (recursive-safe via security definer helper)
create or replace function hotties.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = hotties as $$
  select coalesce((select is_admin from hotties.profiles where id = uid), false);
$$;

drop policy if exists "profiles_admin_all" on hotties.profiles;
create policy "profiles_admin_all" on hotties.profiles
  for all using (hotties.is_admin(auth.uid()))
  with check (hotties.is_admin(auth.uid()));

-- Grants (schema already granted in schema.sql)
grant select on hotties.profiles to anon, authenticated;
grant insert, update on hotties.profiles to authenticated;
grant all on hotties.profiles to service_role;

-- ---------- Storage bucket for profile images ----------
-- Bucket is public-read so the site can show <img> tags directly.
insert into storage.buckets (id, name, public)
values ('hotties-profile-images', 'hotties-profile-images', true)
on conflict (id) do update set public = true;

-- Users can upload/update/delete only files inside their own user-id folder.
-- Path convention: <auth.uid()>/<slot>.<ext>  (slot = 1 | 2 | 3)
drop policy if exists "hth_profile_images_read" on storage.objects;
create policy "hth_profile_images_read" on storage.objects
  for select using (bucket_id = 'hotties-profile-images');

drop policy if exists "hth_profile_images_write_own" on storage.objects;
create policy "hth_profile_images_write_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hotties-profile-images'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hth_profile_images_update_own" on storage.objects;
create policy "hth_profile_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'hotties-profile-images'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hth_profile_images_delete_own" on storage.objects;
create policy "hth_profile_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'hotties-profile-images'
         and (storage.foldername(name))[1] = auth.uid()::text);
