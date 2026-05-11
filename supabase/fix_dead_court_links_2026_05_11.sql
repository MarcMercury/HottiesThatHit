-- Fix dead court links — 2026-05-11
--
-- Generated from `scripts/verify_court_links.ts` + manual browser verification.
-- Each block updates either a sources.booking_url (cascades to all facilities
-- without their own facility_booking_url) or a specific facility_booking_url.
--
-- Dead links left UNCHANGED because manual browser fetch confirmed the URL
-- actually renders (the host blocks non-browser traffic via WAF):
--   - https://www.nycgovparks.org/permits/tennis-permits  (sources.public_open_nyc)
--   - https://www.prospectpark.org/visit-the-park/places-to-go/tennis-center/  (1 facility)
--
-- Probe-side LA Rec timeout was transient; URL verified live with longer timeout:
--   - https://reg.recreation.parks.lacity.gov/.../Cheviot+Hills+Pay+Tennis (no change)

set search_path = hotties, public;

-- ---------------------------------------------------------------------------
-- 1. Source-level booking_url replacements
-- ---------------------------------------------------------------------------

-- Santa Monica migrated from Vermont Systems (web2.vermontsystems.com) to ActiveNet.
-- The old URL times out from outside their network and the platform was retired.
update sources
   set booking_url = 'https://anc.apm.activecommunities.com/santamonicarecreation',
       scraper_type = 'activenet',
       notes = coalesce(notes, '') ||
               case when notes is null or notes = '' then '' else ' | ' end ||
               '2026-05-11: migrated from Vermont Systems (web2.vermontsystems.com) to ActiveNet.'
 where id = 'santa_monica';

-- ---------------------------------------------------------------------------
-- 2. Facility-level booking URL replacements (specific dead URLs)
-- ---------------------------------------------------------------------------

-- NYC Parks: 92 facilities had facility_booking_url='https://www.nycgovparks.org/reg/tennis'
-- which is a real 404. Replace with the canonical online-reservation page.
update facilities
   set facility_booking_url = 'https://www.nycgovparks.org/tennisreservation'
 where facility_booking_url = 'https://www.nycgovparks.org/reg/tennis';

-- Glendale: tennis sub-page 404, parks dept page is live.
update facilities
   set facility_booking_url = 'https://www.glendaleca.gov/government/departments/community-services-parks'
 where facility_booking_url = 'https://www.glendaleca.gov/government/departments/community-services-parks/parks-recreation/tennis-courts';

-- Lakewood: rec & community services slug 404; activities-classes-registration is live.
update facilities
   set facility_booking_url = 'https://www.lakewoodca.gov/Things-to-Do/Activities-Classes-Registration'
 where facility_booking_url = 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services';

-- Manhattan Beach: leisure-classes-and-camps/tennis 404; parks & rec page is live.
update facilities
   set facility_booking_url = 'https://www.manhattanbeach.gov/departments/parks-and-recreation'
 where facility_booking_url = 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis';

-- Westchester County Parks: domain moved from parks.westchestergov.com → parks.westchestercountyny.gov,
-- and the /sports subpath no longer exists.
update facilities
   set facility_booking_url = 'https://parks.westchestercountyny.gov/'
 where facility_booking_url = 'https://parks.westchestergov.com/sports';

-- Essex County Parks: /parks/ subpath 404; root works.
update facilities
   set facility_booking_url = 'https://www.essexcountynj.org/'
 where facility_booking_url = 'https://www.essexcountynj.org/parks/';

-- North Hempstead: /parks-and-recreation 404; root works.
update facilities
   set facility_booking_url = 'https://www.northhempsteadny.gov/'
 where facility_booking_url = 'https://www.northhempsteadny.gov/parks-and-recreation';

-- Montclair Township: recreation slug 404; root works.
update facilities
   set facility_booking_url = 'https://www.montclairnjusa.org/'
 where facility_booking_url = 'https://www.montclairnjusa.org/government/departments-divisions/recreation-cultural-affairs';

-- Rye, NY: /departments/recreation 404; correct path is /government/recreation-department.
update facilities
   set facility_booking_url = 'https://www.ryeny.gov/government/recreation-department'
 where facility_booking_url = 'https://www.ryeny.gov/departments/recreation';

-- Stamford, CT: /government/departments/recreation-services 404; root works.
update facilities
   set facility_booking_url = 'https://www.stamfordct.gov/'
 where facility_booking_url = 'https://www.stamfordct.gov/government/departments/recreation-services';

-- Wayne Township: /government/departments/parks-recreation 404; root works.
update facilities
   set facility_booking_url = 'https://www.waynetownship.com/'
 where facility_booking_url = 'https://www.waynetownship.com/government/departments/parks-recreation';

-- City Parks Foundation: /sports/prospect-park-tennis-center/ 404; their tennis program landing page is live.
update facilities
   set facility_booking_url = 'https://cityparksfoundation.org/play/tennis/'
 where facility_booking_url = 'https://www.cityparksfoundation.org/sports/prospect-park-tennis-center/';

-- City of Whittier: /government/parks-recreation-and-community-services 404; root works.
update facilities
   set facility_booking_url = 'https://cityofwhittier.org/'
 where facility_booking_url = 'https://cityofwhittier.org/government/parks-recreation-and-community-services';

-- Calabasas: /government/community-services/calabasas-tennis-swim-center 404;
-- no usable deep link. Fall back to city root.
update facilities
   set facility_booking_url = 'https://www.cityofcalabasas.com/'
 where facility_booking_url = 'https://www.cityofcalabasas.com/government/community-services/calabasas-tennis-swim-center';

-- ---------------------------------------------------------------------------
-- 3. Swimply listings that returned 404 — those listings were removed by their
--    hosts. Mark facilities inactive so they stop rendering with a dead link.
--    (Their facility_booking_url is preserved for re-enable / debugging.)
-- ---------------------------------------------------------------------------
update facilities
   set active = false
 where source_id = 'swimply'
   and external_id in (
     'swimply:37378',
     'swimply:39477',
     'swimply:48340',
     'swimply:49682',
     'swimply:51706',
     'swimply:52805',
     'swimply:59441',
     'swimply:59915',
     'swimply:61809',
     'swimply:64028',
     'swimply:75650'
   );
