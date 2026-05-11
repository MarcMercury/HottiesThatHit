-- Fix booking URLs introduced by enrich_secretnyc_courts.sql and earlier seeds
-- that point to dead/incorrect domains.
-- Verified May 2026 via HTTP checks.

-- McCarren: mccarrentenniscenter.com is dead; correct host is mccarrentennisnyc.com.
update hotties.facilities
   set facility_booking_url = 'https://www.mccarrentennisnyc.com/',
       website              = 'https://www.mccarrentennisnyc.com/'
 where facility_booking_url = 'https://mccarrentenniscenter.com/';

update hotties.facilities
   set website = 'https://www.mccarrentennisnyc.com/'
 where website = 'https://mccarrentenniscenter.com/';

-- Prospect Park Tennis Center: prospectparktenniscenter.com is dead.
-- Fall back to City Parks Foundation operator page.
update hotties.facilities
   set facility_booking_url = 'https://www.cityparksfoundation.org/sports/',
       website              = 'https://www.cityparksfoundation.org/sports/'
 where facility_booking_url = 'https://prospectparktenniscenter.com/';

update hotties.facilities
   set website = 'https://www.cityparksfoundation.org/sports/'
 where website = 'https://prospectparktenniscenter.com/';

-- USTA Billie Jean King NTC: old usta.com slug 404s; ntc.usta.com is the live home.
update hotties.facilities
   set facility_booking_url = 'https://www.ntc.usta.com/'
 where facility_booking_url = 'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html';

-- Tennis in Manhattan: per-club sub-pages 404; only the root resolves.
update hotties.facilities
   set facility_booking_url = 'https://tennisinmanhattan.com/',
       website              = 'https://tennisinmanhattan.com/'
 where facility_booking_url in (
   'https://tennisinmanhattan.com/vanderbilt-tennis-club/',
   'https://tennisinmanhattan.com/sutton-east-tennis-club/',
   'https://tennisinmanhattan.com/yorkville-tennis-club/'
 );

-- Riverside Clay: riversideclay.org is dead. Use Riverside Park NYC home.
update hotties.facilities
   set website = 'https://riversideparknyc.org/'
 where website = 'https://www.riversideclay.org/';

-- Alley Pond: alleypondtennis.com domain expired; no clean replacement, clear it.
update hotties.facilities
   set facility_booking_url = null,
       website = null
 where facility_booking_url = 'https://alleypondtennis.com/'
    or website = 'https://alleypondtennis.com/';
