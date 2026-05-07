-- Hotties That Hit: Day-1 Step 6 outcome
-- LA City Rec migrated off ActiveNet. There is no public LA-area municipal
-- tennis booking API. Seed the 8 LA Rec pay-court facilities as a static
-- directory and disable the la_rec scraper so cron stops erroring.

-- Disable scrapers that no longer have a usable booking API.
update hotties.sources set
  enabled = false,
  notes = 'No online booking API. Phone reservations only. Static facility data seeded.'
where id = 'la_rec';

-- Make sure la_rec source row exists before inserting facilities below.
-- (already seeded by initial schema.sql; this is idempotent)

-- Pay-court facilities maintained by City of Los Angeles Department of Recreation and Parks.
-- Source: https://recreation.parks.lacity.gov/sports/tennis/pay (May 2026)
insert into hotties.facilities (source_id, external_id, name, address, city, num_courts, surface, lights)
values
  ('la_rec', 'la_rec:balboa',         'Balboa Tennis Courts',                     '17015 Burbank Blvd., Encino, CA 91316',         'Encino',          null, 'Hard', true),
  ('la_rec', 'la_rec:cheviot_hills',  'Cheviot Hills Tennis Courts',              '2551 Motor Ave., Los Angeles, CA 90064',        'Los Angeles',     14,   'Hard', true),
  ('la_rec', 'la_rec:poinsettia',     'Poinsettia Tennis Courts',                 '7341 Willoughby Ave., Los Angeles, CA 90046',   'Los Angeles',     null, 'Hard', true),
  ('la_rec', 'la_rec:riverside',      'Riverside Tennis Courts (Griffith)',       '3401 Riverside Drive, Los Angeles, CA 90027',   'Los Angeles',     null, 'Hard', true),
  ('la_rec', 'la_rec:van_nuys',       'Van Nuys / Sherman Oaks Tennis Courts',    '14201 Huston Street, Van Nuys, CA 91423',       'Van Nuys',        null, 'Hard', true),
  ('la_rec', 'la_rec:vermont_canyon', 'Vermont Canyon Tennis Courts (Griffith)',  '2715 Vermont Cyn., Los Angeles, CA 90027',      'Los Angeles',     null, 'Hard', false),
  ('la_rec', 'la_rec:westchester',    'Westchester Tennis Courts',                '7000 W. Manchester Ave., Los Angeles, CA 90045','Los Angeles',     null, 'Hard', true),
  ('la_rec', 'la_rec:westwood',       'Westwood Tennis Courts',                   '1350 Sepulveda Blvd., Los Angeles, CA 90024',   'Los Angeles',     8,    'Hard', true),
  ('la_rec', 'la_rec:pacific_palisades', 'Pacific Palisades Tennis Courts',       '851 Alma Real Dr., Pacific Palisades, CA 90272','Pacific Palisades', null, 'Hard', true)
on conflict (source_id, external_id) do update set
  name       = excluded.name,
  address    = excluded.address,
  city       = excluded.city,
  num_courts = excluded.num_courts,
  surface    = excluded.surface,
  lights     = excluded.lights;
