-- Tennis in Manhattan clubs (Vanderbilt / Sutton East / Yorkville).
-- Source: https://tennisinmanhattan.com/
-- 3 affiliated private indoor tennis clubs in Manhattan.

insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
  ('tennis_in_manhattan', 'Tennis in Manhattan',
   'https://tennisinmanhattan.com/', 'custom', false,
   'Three affiliated private indoor tennis clubs in Manhattan: Vanderbilt, Sutton East, Yorkville. Seasonal court time, instruction, drills.')
on conflict (id) do update set
  name = excluded.name,
  booking_url = excluded.booking_url,
  notes = excluded.notes;

insert into hotties.facilities
  (source_id, external_id, name, address, city, lat, lng, num_courts, surface,
   lights, active, category, region, phone, online_booking, facility_booking_url,
   website, metro, is_indoor)
values
  ('tennis_in_manhattan', 'tim:vanderbilt',
   'Vanderbilt Tennis Club',
   '15 Vanderbilt Ave 4th Floor, New York, NY 10017',
   'New York', 40.7527, -73.9772, 2, 'Hard', true, true,
   'Private Club', 'Manhattan', '(212) 599-6500', false,
   'https://tennisinmanhattan.com/vanderbilt-tennis-club/',
   'https://tennisinmanhattan.com/vanderbilt-tennis-club/', 'NYC', true),
  ('tennis_in_manhattan', 'tim:sutton_east',
   'Sutton East Tennis Club',
   '488 East 60th Street, New York, NY 10022',
   'New York', 40.7607, -73.9620, 8, 'Clay', true, true,
   'Private Club', 'Manhattan', '(212) 751-3452', false,
   'https://tennisinmanhattan.com/sutton-east-tennis-club/',
   'https://tennisinmanhattan.com/sutton-east-tennis-club/', 'NYC', true),
  ('tennis_in_manhattan', 'tim:yorkville',
   'Yorkville Tennis Club',
   '1725 York Avenue, New York, NY 10128',
   'New York', 40.7727, -73.9474, 3, 'Hard', true, true,
   'Private Club', 'Manhattan', '(212) 987-0301', false,
   'https://tennisinmanhattan.com/yorkville-tennis-club/',
   'https://tennisinmanhattan.com/yorkville-tennis-club/', 'NYC', true)
on conflict (source_id, external_id) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  lat = excluded.lat,
  lng = excluded.lng,
  num_courts = excluded.num_courts,
  surface = excluded.surface,
  lights = excluded.lights,
  category = excluded.category,
  region = excluded.region,
  phone = excluded.phone,
  online_booking = excluded.online_booking,
  facility_booking_url = excluded.facility_booking_url,
  website = excluded.website,
  metro = excluded.metro,
  is_indoor = excluded.is_indoor,
  active = excluded.active;
