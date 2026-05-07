-- Hotties That Hit: schema lives separately from Trauma Box's `public` schema.

create extension if not exists "uuid-ossp";
create schema if not exists hotties;

-- Booking platforms / sources
create table if not exists hotties.sources (
  id text primary key,
  name text not null,
  booking_url text not null,
  scraper_type text not null,           -- 'activenet' | 'civicrec' | 'courtreserve' | 'custom'
  enabled boolean not null default true,
  notes text
);

-- Physical facilities
create table if not exists hotties.facilities (
  id uuid primary key default uuid_generate_v4(),
  source_id text not null references hotties.sources(id) on delete cascade,
  external_id text not null,
  name text not null,
  address text,
  city text,
  lat numeric,
  lng numeric,
  num_courts int,
  surface text,
  lights boolean default false,
  active boolean not null default true,
  unique (source_id, external_id)
);

create index if not exists facilities_city_idx on hotties.facilities (city);
create index if not exists facilities_source_idx on hotties.facilities (source_id);

-- Bookable slots
create table if not exists hotties.slots (
  id uuid primary key default uuid_generate_v4(),
  facility_id uuid not null references hotties.facilities(id) on delete cascade,
  court_number text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  available boolean not null,
  price_cents int,
  booking_url text,
  scraped_at timestamptz not null default now(),
  unique (facility_id, court_number, start_time)
);

create index if not exists slots_available_idx on hotties.slots (start_time, available)
  where available = true;
create index if not exists slots_facility_time_idx on hotties.slots (facility_id, start_time);

-- Scrape run log
create table if not exists hotties.scrape_runs (
  id uuid primary key default uuid_generate_v4(),
  source_id text not null references hotties.sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  slots_found int default 0,
  slots_available int default 0,
  error_message text
);

create index if not exists scrape_runs_source_idx on hotties.scrape_runs (source_id, started_at desc);

-- Grants for PostgREST access (Supabase). Schema must also be added to "Exposed schemas" in dashboard.
grant usage on schema hotties to anon, authenticated, service_role;
grant all on all tables in schema hotties to service_role;
grant select on all tables in schema hotties to anon, authenticated;
alter default privileges in schema hotties grant all on tables to service_role;
alter default privileges in schema hotties grant select on tables to anon, authenticated;

-- Seed the sources we know about
insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
  ('la_rec',         'LA City Recreation & Parks', 'https://anc.apm.activecommunities.com/laparks',                                                    'activenet',    true,  'ActiveNet platform; ~40 facilities'),
  ('santa_monica',   'Santa Monica',               'https://web2.vermontsystems.com/wbwsc/casantamonicawt.wsc/splash.html',                            'civicrec',     false, 'CivicRec / VSI platform'),
  ('beverly_hills',  'Beverly Hills',              'https://www.beverlyhills.org/departments/communityservices/recreationservices/tennisreservations/','custom',       false, 'Resident-only system'),
  ('culver_city',    'Culver City',                'https://anc.apm.activecommunities.com/culvercity',                                                  'activenet',    false, 'Same ActiveNet pattern as LA Rec'),
  ('pasadena',       'Pasadena',                   'https://anc.apm.activecommunities.com/pasadenarec',                                                 'activenet',    false, 'Same ActiveNet pattern'),
  ('burbank',        'Burbank',                    'https://anc.apm.activecommunities.com/burbankparksandrec',                                          'activenet',    false, 'Same ActiveNet pattern'),
  ('westside_tc',    'Westside Tennis Club',       'https://app.courtreserve.com/Online/Reservations/Bookings/9999',                                    'courtreserve', false, 'Private; needs login')
on conflict (id) do nothing;
