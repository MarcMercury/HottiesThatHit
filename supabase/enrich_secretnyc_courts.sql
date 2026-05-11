-- Enrichment for NYC tennis venues featured in
-- https://secretnyc.co/best-tennis-courts-in-nyc/
-- Adds missing lat/lng, booking URLs, and indoor flags to existing rows.
-- (Vanderbilt is already seeded by seed_tennisinmanhattan.sql.)
-- Pop-up courts from the article (Match Point Pier 17, Racquet Rockefeller)
-- are intentionally excluded — both were temporary Aug 2024 activations.

-- McCarren Tennis Center -- 50 Bedford Ave, Brooklyn
-- 5 public courts; seasonal bubble; ~$45/hr
update hotties.facilities
   set lat = 40.7224,
       lng = -73.9519,
       address = coalesce(address, '50 Bedford Ave, Brooklyn, NY 11211'),
       city    = coalesce(city, 'Brooklyn'),
       num_courts = greatest(coalesce(num_courts, 0), 5),
       online_booking = true,
       facility_booking_url = coalesce(facility_booking_url, 'https://mccarrentenniscenter.com/'),
       website = coalesce(website, 'https://mccarrentenniscenter.com/'),
       is_indoor = true  -- seasonal bubble
 where source_id = 'nyc_parks'
   and external_id = 'nyc_parks:mccarren_tennis_center';

-- Sportime at Randall's Island / John McEnroe Tennis Academy
-- 1 Randall's Island, 24 courts, 160k sq ft
update hotties.facilities
   set lat = 40.7906,
       lng = -73.9213,
       address = coalesce(address, '1 Randall''s Island, New York, NY 10035'),
       city    = coalesce(city, 'New York'),
       num_courts = greatest(coalesce(num_courts, 0), 24),
       online_booking = true,
       facility_booking_url = coalesce(facility_booking_url, 'https://www.sportimeny.com/randallsisland/'),
       website = coalesce(website, 'https://www.sportimeny.com/randallsisland/'),
       is_indoor = true
 where source_id = 'nyc_parks'
   and external_id = 'nyc_parks:sportime_at_randall_s_island';

-- Central Park Tennis Center -- 30 total courts (6 reservable + 26 walk-on permit)
update hotties.facilities
   set num_courts = greatest(coalesce(num_courts, 0), 30),
       address = coalesce(address, '93rd St & Central Park West, New York, NY 10025'),
       city    = coalesce(city, 'New York'),
       online_booking = true,
       facility_booking_url = coalesce(facility_booking_url, 'https://www.nycgovparks.org/reg/tennis'),
       website = coalesce(website, 'https://www.centralparktenniscenter.com/')
 where source_id = 'nyc_parks'
   and external_id = 'nyc_parks:central_park';

-- Hudson River Park hardcourts -- 3 courts between Pier 40 and Pier 34, free, 6am-midnight
update hotties.facilities
   set address = coalesce(address, 'Hudson River Park between Houston St & Canal St, New York, NY'),
       city    = coalesce(city, 'New York'),
       website = coalesce(website, 'https://hudsonriverpark.org/activities/tennis/')
 where source_id = 'public_open_nyc'
   and external_id = 'public_open_nyc:hudson_river_park';

-- USTA Billie Jean King NTC -- richer detail
update hotties.facilities
   set address = coalesce(address, 'Flushing Meadows-Corona Park, Queens, NY 11368'),
       city    = coalesce(city, 'Queens'),
       website = coalesce(website, 'https://www.ntc.usta.com/')
 where source_id = 'usta_bjk'
   and external_id = 'usta_bjk:ntc';

-- Prospect Park Tennis Center -- 50 Parkside Ave; seasonal bubble + year-round indoor
update hotties.facilities
   set address = coalesce(address, '50 Parkside Ave, Brooklyn, NY 11226'),
       city    = coalesce(city, 'Brooklyn'),
       facility_booking_url = coalesce(facility_booking_url, 'https://prospectparktenniscenter.com/'),
       website = coalesce(website, 'https://prospectparktenniscenter.com/'),
       is_indoor = true
 where source_id = 'cityparks'
   and external_id = 'cityparks:prospect_park';

-- Oscar Hijuelos / Riverside Clay courts -- near 96th St, Riverside Park
update hotties.facilities
   set address = coalesce(address, 'Riverside Park near 96th St, New York, NY 10025'),
       city    = coalesce(city, 'New York'),
       website = coalesce(website, 'https://www.riversideclay.org/'),
       facility_booking_url = coalesce(facility_booking_url, 'https://www.nycgovparks.org/reg/tennis')
 where source_id = 'nyc_parks'
   and external_id = 'nyc_parks:riverside_clay';
