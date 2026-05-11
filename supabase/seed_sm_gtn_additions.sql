-- AUTO-GENERATED from globaltennisnetwork.com city=Santa Monica search.
-- Source script: scripts/build_sm_gtn_additions.py
-- Adds Santa Monica + Pacific Palisades facilities missing from seed_la_courts_full.sql.

alter table hotties.facilities
  add column if not exists gtn_id integer,
  add column if not exists is_indoor boolean;

insert into hotties.facilities
  (source_id, external_id, name, address, city, lat, lng, num_courts, surface,
   lights, active, category, region, phone, metro, gtn_id, is_indoor)
values
  ('santa_monica', 'santa_monica:clover_park', 'Clover Park', '2600 Ocean Park Blvd, Santa Monica, California 90405', 'Santa Monica', 34.01527335573265, -118.45637079073792, 2, null, false, true, 'Public Open', 'Westside', '(310) 458-8300', 'LA', 52338, false),
  ('santa_monica', 'santa_monica:los_amigos_park', 'Los Amigos Park', '2598 6th St, Santa Monica, California 90405', 'Santa Monica', 34.0066814762357, -118.481664061546, 1, null, false, true, 'Public Open', 'Westside', '(310) 458-8643', 'LA', 12594, false),
  ('santa_monica', 'santa_monica:marine_park', 'Marine Park', '1406 Marine St, Santa Monica, California 90405', 'Santa Monica', 34.0051339220531, -118.466370105743, 3, null, false, true, 'Public Open', 'Westside', '(310) 458-8300', 'LA', 15151, false),
  ('santa_monica', 'santa_monica:memorial_park', 'Memorial Park', '1401 Olympic Blvd, Santa Monica, California 90404', 'Santa Monica', 34.0211506324799, -118.481476306915, 4, null, false, true, 'Public Open', 'Westside', '(310) 450-1121', 'LA', 15137, false),
  ('santa_monica', 'santa_monica:ocean_view_park', 'Ocean View Park', '2701 Barnard Way, Santa Monica, California 90405', 'Santa Monica', 33.9996772344638, -118.483927845955, 6, null, false, true, 'Public Open', 'Westside', null, 'LA', 15154, false),
  ('public_open', 'public_open:riviera_tennis_club', 'Riviera Tennis Club', '1250 Capri Drive, Pacific Palisades, California Palisades', 'Pacific Palisades', 34.0509349202923, -118.499168157578, 24, null, false, true, 'Private Club', 'Westside', '(310) 454-6591', 'LA', 15087, false),
  ('santa_monica', 'santa_monica:roosevelt_elementary_school', 'Roosevelt Elementary School', '801 Montana Ave, Santa Monica, California 90402', 'Santa Monica', 34.0293401311953, -118.502440452576, 2, null, false, true, 'School', 'Westside', null, 'LA', 15122, false),
  ('santa_monica', 'santa_monica:rustic_canyon_recreation_center', 'Rustic Canyon Recreation Center', '601 Latimer Rd, Santa Monica, California 90402', 'Santa Monica', 34.0389780074745, -118.514285087585, 6, null, false, true, 'Public Open', 'Westside', '(310) 454-5734', 'LA', 8903, false)
on conflict (source_id, external_id) do update set
  name = excluded.name,
  address = coalesce(excluded.address, hotties.facilities.address),
  lat = coalesce(excluded.lat, hotties.facilities.lat),
  lng = coalesce(excluded.lng, hotties.facilities.lng),
  num_courts = coalesce(excluded.num_courts, hotties.facilities.num_courts),
  phone = coalesce(excluded.phone, hotties.facilities.phone),
  category = excluded.category,
  region = excluded.region,
  metro = excluded.metro,
  gtn_id = coalesce(excluded.gtn_id, hotties.facilities.gtn_id),
  is_indoor = coalesce(excluded.is_indoor, hotties.facilities.is_indoor);

-- Inserted: 8; skipped (already in LA seed): 1
--   skip: Reed Park