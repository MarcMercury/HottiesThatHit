-- Fix broken / outdated reservation links discovered during May 2026 audit.
-- Probed each link with curl + browser UA. Many city pages had moved or returned
-- 404/500. Where a real online booking system exists, point straight at the
-- deeplink (Rec1 catalog, ActiveNet activity_search, UCLA Recreation, etc.).
-- For sites that block bots and we can't verify, use the city home page.

-- --- 1. Sources --------------------------------------------------------------
-- Add City of Beverly Hills (was missing — facilities reference source_id='beverly_hills').
insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
  ('beverly_hills', 'City of Beverly Hills',
   'https://www.beverlyhills.org/',
   'custom', false,
   'La Cienega + Roxbury + Beverly Hills HS. Resident-priority booking; phone primary.')
on conflict (id) do nothing;

-- Repoint sources whose original URLs are dead or moved.
update hotties.sources set
  booking_url = 'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis',
  scraper_type = 'activenet',
  notes = 'ActiveNet (LB Rec Connect). Billie Jean King + El Dorado online booking.'
where id = 'long_beach';

update hotties.sources set
  booking_url = 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services',
  notes = 'Lakewood Tennis Center. Resident-priority booking via city rec.'
where id = 'lakewood';

update hotties.sources set
  booking_url = 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis',
  notes = 'Live Oak + Mira Costa. citymb.info domain retired; now manhattanbeach.gov.'
where id = 'manhattan_beach';

update hotties.sources set
  booking_url = 'https://www.redondo.org/',
  notes = 'Alta Vista Tennis Center. Phone reservations primary.'
where id = 'redondo_beach';

update hotties.sources set
  booking_url = 'https://secure.rec1.com/CA/el-segundo-ca/catalog',
  scraper_type = 'rec1',
  notes = 'Rec1 catalog. Online booking via El Segundo Recreation, Parks & Library.'
where id = 'el_segundo';

update hotties.sources set
  booking_url = 'https://secure.rec1.com/CA/san-marino-ca/catalog',
  scraper_type = 'rec1',
  notes = 'Rec1 catalog (San Marino Community Services). Old sanmarinotenniscenter.com retired.'
where id = 'san_marino';

update hotties.sources set
  booking_url = 'https://www.cerritos.gov/',
  notes = 'City of Cerritos (cerritos.us → cerritos.gov). Cerritos Tennis Center: resident booking.'
where id = 'cerritos';

update hotties.sources set
  booking_url = 'https://secure.rec1.com/CA/la-mirada-community-services/catalog',
  scraper_type = 'rec1',
  notes = 'Rec1 catalog (La Mirada Community Services). cityoflamirada.org retired.'
where id = 'la_mirada';

update hotties.sources set
  booking_url = 'https://anc.apm.activecommunities.com/cityofdowney/activity/search?activity_keyword=tennis',
  scraper_type = 'activenet',
  notes = 'ActiveNet (City of Downey). Independence Park Tennis Center.'
where id = 'downey';

update hotties.sources set
  booking_url = 'https://recreation.ucla.edu/facilities/los-angeles-tennis-center',
  notes = 'UCLA Recreation (uclatenniscenter.com retired). Member club; limited public access.'
where id = 'ucla';

-- --- 2. Per-facility booking URL overrides ----------------------------------
-- Each row is a verified deep link or a corrected canonical landing page.

-- Redondo Beach: old /depts/recreation/ returns 404. Use city home until we
-- verify a CourtReserve org slug for Alta Vista TC.
update hotties.facilities set
  facility_booking_url = 'https://www.redondo.org/'
where source_id = 'redondo_beach' and external_id = 'redondo_beach:alta_vista_tennis_center';

-- Long Beach BJK + El Dorado → ActiveNet tennis search deeplink.
update hotties.facilities set
  facility_booking_url = 'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis'
where source_id = 'long_beach'
  and external_id in (
    'long_beach:billie_jean_king_tennis_center',
    'long_beach:el_dorado_tennis_center'
  );

-- Lakewood Tennis Center → new lakewoodca.gov domain.
update hotties.facilities set
  facility_booking_url = 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services'
where source_id = 'lakewood' and external_id = 'lakewood:lakewood_tennis_center';

-- Manhattan Beach: citymb.info → manhattanbeach.gov.
update hotties.facilities set
  facility_booking_url = 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis'
where source_id = 'manhattan_beach'
  and external_id in (
    'manhattan_beach:live_oak_park_tennis_center',
    'manhattan_beach:mira_costa_high_school'
  );

-- El Segundo: now confirmed online via Rec1.
update hotties.facilities set
  facility_booking_url = 'https://secure.rec1.com/CA/el-segundo-ca/catalog',
  online_booking = true
where source_id = 'el_segundo'
  and external_id = 'el_segundo:el_segundo_parks_recreation_tennis_center';

-- San Marino TC: old domain dead → Rec1 catalog.
update hotties.facilities set
  facility_booking_url = 'https://secure.rec1.com/CA/san-marino-ca/catalog'
where source_id = 'san_marino' and external_id = 'san_marino:san_marino_tennis_center';

-- Cerritos: cerritos.us is dead → cerritos.gov.
update hotties.facilities set
  facility_booking_url = 'https://www.cerritos.gov/'
where source_id = 'cerritos' and external_id = 'cerritos:cerritos_tennis_center';

-- La Mirada: old domain returns 500 → Rec1 catalog (real online booking).
update hotties.facilities set
  facility_booking_url = 'https://secure.rec1.com/CA/la-mirada-community-services/catalog'
where source_id = 'la_mirada' and external_id = 'la_mirada:la_mirada_tennis_center';

-- Downey Independence Park TC → ActiveNet tennis search.
update hotties.facilities set
  facility_booking_url = 'https://anc.apm.activecommunities.com/cityofdowney/activity/search?activity_keyword=tennis'
where source_id = 'downey' and external_id = 'downey:independence_park_tennis_center';

-- UCLA Tennis Center: uclatenniscenter.com is dead → UCLA Recreation.
update hotties.facilities set
  facility_booking_url = 'https://recreation.ucla.edu/facilities/los-angeles-tennis-center'
where source_id = 'ucla' and external_id = 'ucla:los_angeles_tennis_center';

-- Beverly Hills: deep /communityservices/tennis-pickleball is 404; fall back to
-- city home until a verified booking deeplink is found.
update hotties.facilities set
  facility_booking_url = 'https://www.beverlyhills.org/'
where source_id = 'beverly_hills'
  and external_id in (
    'beverly_hills:la_cienega_tennis_center',
    'beverly_hills:roxbury_memorial_park',
    'beverly_hills:beverly_hills_high_school'
  );
