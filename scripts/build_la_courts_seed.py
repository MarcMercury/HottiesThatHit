#!/usr/bin/env python3
"""Generate supabase/seed_la_courts_full.sql from tennismaps_la.json,
enriched with hand-curated booking metadata for known online systems."""
import json, re, sys
from textwrap import dedent

courts = json.load(open('/tmp/tennis/tennismaps_la.json'))

# ---- known booking systems (manual curation) -------------------------------
# Maps a tennismaps name -> (source_id, online_booking, booking_url, override_external_id?)
# override_external_id matches the IDs in supabase/seed_la_rec.sql so the upsert
# updates existing rows instead of creating duplicates.
BOOKING_OVERRIDES = {
    # LA City Rec — WebTrac (account required, online booking)
    'Balboa Sports Complex':              ('la_rec', True,  'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=Balboa+Pay+Tennis', 'la_rec:balboa'),
    'Chevoit Hills Sports Center':        ('la_rec', True,  'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=Cheviot+Hills+Pay+Tennis', 'la_rec:cheviot_hills'),
    'Riverside (Griffith) Tennis Center': ('la_rec', True,  'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=Riverside+Pay+Tennis', 'la_rec:riverside'),
    'Westwood Tennis Center':             ('la_rec', True,  'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=Westwood+Pay+Tennis', 'la_rec:westwood'),
    'Westchester Tennis Courts':          ('la_rec', True,  'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=Westchester+Pay+Tennis', 'la_rec:westchester'),
    'Van Nuys - Sherman Oaks Tennis Center': ('la_rec', True, 'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=VNSO+Pay+Tennis', 'la_rec:van_nuys'),
    'Palisades Tennis Center':            ('la_rec', True,  'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc/search.html?Module=FR&category=Pacific+Palisades+Pay+Tennis', 'la_rec:pacific_palisades'),
    'Plummer Park':                       ('la_rec', False, None, None),
    # Beverly Hills (Pickleball/Tennis Centers — resident priority, online)
    'La Cienega Tennis Center':           ('beverly_hills', True, 'https://www.beverlyhills.org/departments/communityservices/tennis-pickleball'),
    'Roxbury Memorial Park':              ('beverly_hills', True, 'https://www.beverlyhills.org/departments/communityservices/tennis-pickleball'),
    'Beverly Hills High School':          ('beverly_hills', True, 'https://www.beverlyhills.org/departments/communityservices/tennis-pickleball'),
    # LA County (ActiveNet)
    'Arcadia County Park':                ('la_county', True, 'https://anc.apm.activecommunities.com/lacountyparks'),
    'Frank G. Bonelli Regional Park':     ('la_county', True, 'https://anc.apm.activecommunities.com/lacountyparks'),
    # Long Beach (ActiveNet — LB Rec Connect)
    'Billie Jean King Tennis Center':     ('long_beach', True, 'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis'),
    'El Dorado Tennis Center':            ('long_beach', True, 'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis'),
    'Lakewood Tennis Center':             ('lakewood',    True, 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services'),
    # South Bay
    'Live Oak Park Tennis Center':        ('manhattan_beach', True, 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis'),
    'Mira Costa High School':             ('manhattan_beach', True, 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis'),
    'El Segundo Parks & Recreation Tennis Center': ('el_segundo', True, 'https://secure.rec1.com/CA/el-segundo-ca/catalog'),
    'Alta Vista Tennis Center':           ('redondo_beach', True, 'https://www.redondo.org/'),
    # San Fernando Valley
    'Calabasas Tennis and Swim Center':   ('calabasas', True, 'https://www.cityofcalabasas.com/government/community-services/calabasas-tennis-swim-center'),
    'Fremont Park Tennis Center':         ('glendale',  True, 'https://www.glendaleca.gov/government/departments/community-services-parks/parks-recreation/tennis-courts'),
    'Glorieta Park Tennis Center':        ('glendale',  True, 'https://www.glendaleca.gov/government/departments/community-services-parks/parks-recreation/tennis-courts'),
    # Pasadena / SGV
    'San Marino Tennis Center':           ('san_marino', True, 'https://secure.rec1.com/CA/san-marino-ca/catalog'),
    # Cerritos / Norwalk / La Mirada
    'Cerritos Tennis Center':             ('cerritos', True, 'https://www.cerritos.gov/'),
    'La Mirada Tennis Center':            ('la_mirada', True, 'https://secure.rec1.com/CA/la-mirada-community-services/catalog'),
    'Independence Park Tennis Center':    ('downey',    True, 'https://anc.apm.activecommunities.com/cityofdowney/activity/search?activity_keyword=tennis'),
    'Palm Park Tennis Center':            ('whittier',  True, 'https://cityofwhittier.org/government/parks-recreation-and-community-services'),
    # University / private public-access
    'Los Angeles Tennis Center':          ('ucla',      False, 'https://recreation.ucla.edu/facilities/los-angeles-tennis-center'),
    # Santa Monica
    'Reed Park':                          ('santa_monica', True, 'https://www.santamonica.gov/places/parks/reed-park'),
}

# Free-park drop-in defaults: public open => no online booking
# Public Managed without override => phone reservation only

# ---- city heuristic from lat/lng -------------------------------------------
def region(p):
    lat, lng = p['lat'], p['lng']
    # rough boxes
    if 34.10 <= lat <= 34.30 and -118.85 <= lng <= -118.30: return 'San Fernando Valley'
    if 34.00 <= lat <= 34.18 and -118.30 <= lng <= -118.05: return 'Northeast LA / SGV'
    if 33.95 <= lat <= 34.10 and -118.55 <= lng <= -118.30: return 'Westside'
    if 33.75 <= lat <= 33.95 and -118.45 <= lng <= -118.20: return 'South Bay'
    if 33.70 <= lat <= 33.90 and -118.25 <= lng <= -118.00: return 'Long Beach / Cerritos'
    if 33.95 <= lat <= 34.15 and -118.30 <= lng <= -118.15: return 'Central LA'
    if 34.00 <= lat <= 34.20 and -118.05 <= lng <= -117.60: return 'San Gabriel Valley'
    return 'Greater LA'

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')[:60]

# ---- decide which to seed --------------------------------------------------
KEEP_CATEGORIES = {'Public Open', 'Public Managed'}  # skip private + most school-gated
seeded = []
for c in courts:
    if c['category'] not in KEEP_CATEGORIES:
        continue
    seeded.append(c)

print(f'seeding {len(seeded)} courts', file=sys.stderr)

# ---- emit SQL --------------------------------------------------------------
def sql_str(s):
    if s is None or s == '':
        return 'null'
    return "'" + str(s).replace("'", "''") + "'"

def sql_bool(b):
    return 'true' if b else 'false'

out = []
out.append("-- AUTO-GENERATED from tennismaps.com regionid=104 (LA region) + curated booking metadata.")
out.append("-- Source script: scripts/build_la_courts_seed.py")
out.append("")
out.append("-- 1. Schema additions (idempotent) ----------------------------------------")
out.append(dedent("""\
alter table hotties.facilities
  add column if not exists tm_id int,
  add column if not exists category text,
  add column if not exists region text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists booking_provider text,
  add column if not exists online_booking boolean not null default false,
  add column if not exists facility_booking_url text;

create index if not exists facilities_category_idx on hotties.facilities (category);
create index if not exists facilities_region_idx on hotties.facilities (region);
create index if not exists facilities_online_booking_idx on hotties.facilities (online_booking);
"""))

out.append("-- 2. Sources --------------------------------------------------------------")
out.append(dedent("""\
insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
  ('la_county',       'LA County Parks',           'https://anc.apm.activecommunities.com/lacountyparks',       'activenet', false, 'County-run parks. ActiveNet booking.'),
  ('long_beach',      'City of Long Beach',        'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis', 'activenet', false, 'ActiveNet (LB Rec Connect). Billie Jean King + El Dorado.'),
  ('lakewood',        'City of Lakewood',          'https://www.lakewoodca.gov/government/departments/recreation-and-community-services', 'custom', false, 'Lakewood Tennis Center.'),
  ('manhattan_beach', 'City of Manhattan Beach',   'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis', 'custom', false, 'Live Oak + Mira Costa.'),
  ('redondo_beach',   'City of Redondo Beach',     'https://www.redondo.org/',                                  'custom', false, 'Alta Vista TC. Phone reservations primary.'),
  ('el_segundo',      'City of El Segundo',        'https://secure.rec1.com/CA/el-segundo-ca/catalog',          'rec1',   false, 'Rec1 catalog. Online booking via El Segundo Recreation, Parks & Library.'),
  ('calabasas',       'City of Calabasas',         'https://www.cityofcalabasas.com/government/community-services/calabasas-tennis-swim-center', 'custom', false, 'Calabasas Tennis & Swim Center.'),
  ('glendale',        'City of Glendale',          'https://www.glendaleca.gov/government/departments/community-services-parks/parks-recreation/tennis-courts', 'custom', false, 'Fremont + Glorieta.'),
  ('san_marino',      'San Marino Community Services', 'https://secure.rec1.com/CA/san-marino-ca/catalog',      'rec1',   false, 'Rec1 catalog. Old sanmarinotenniscenter.com retired.'),
  ('cerritos',        'City of Cerritos',          'https://www.cerritos.gov/',                                 'custom', false, 'Cerritos Tennis Center: resident booking.'),
  ('la_mirada',       'City of La Mirada',         'https://secure.rec1.com/CA/la-mirada-community-services/catalog', 'rec1', false, 'Rec1 catalog (La Mirada Community Services).'),
  ('downey',          'City of Downey',            'https://anc.apm.activecommunities.com/cityofdowney/activity/search?activity_keyword=tennis', 'activenet', false, 'ActiveNet. Independence Park TC.'),
  ('whittier',        'City of Whittier',          'https://cityofwhittier.org/government/parks-recreation-and-community-services', 'custom', false, 'Palm Park TC.'),
  ('beverly_hills',   'City of Beverly Hills',     'https://www.beverlyhills.org/',                             'custom', false, 'La Cienega + Roxbury + Beverly Hills HS. Resident-priority booking; phone primary.'),
  ('ucla',            'UCLA Recreation',           'https://recreation.ucla.edu/facilities/los-angeles-tennis-center', 'custom', false, 'Member club; limited public access.'),
  ('public_open',     'Free public park courts',   'https://www.tennismaps.com/index.asp?regionid=104',         'static',    false, 'Drop-in / first-come-first-served park courts. No online booking.')
on conflict (id) do update set
  name = excluded.name,
  booking_url = excluded.booking_url,
  scraper_type = excluded.scraper_type,
  notes = excluded.notes;
"""))

out.append("-- 3. Facilities ---------------------------------------------------------")
out.append("-- Each row sourced from tennismaps.com. Lat/lng verified by tennismaps; addresses to geocode later.")
out.append("")

# Build VALUES rows
rows = []
for c in seeded:
    name = c['name']
    tm_id = c['tm_id']
    cat = c['category']
    rg = region(c)
    phone = c['phone']
    courts_n = c['courts']
    lat = c['lat']
    lng = c['lng']

    # Find best override match (exact name match)
    override = None
    for key, val in BOOKING_OVERRIDES.items():
        if key.lower() == name.lower():
            override = val
            break

    if override:
        # override is (source_id, online, burl, ext_override?)
        if len(override) == 4 and override[3]:
            source_id, online, burl, ext = override[0], override[1], override[2], override[3]
        else:
            source_id, online, burl = override[0], override[1], override[2]
            ext = f'{source_id}:{slug(name)}'
    elif cat == 'Public Open':
        source_id, online, burl = 'public_open', False, None
        ext = f'{source_id}:{slug(name)}'
    else:
        source_id, online, burl = 'public_open', False, None
        ext = f'{source_id}:{slug(name)}'

    rows.append((source_id, ext, name, lat, lng, courts_n, cat, rg, phone, online, burl, tm_id))

# Dedupe by (source_id, ext)
seen = set()
unique = []
for r in rows:
    key = (r[0], r[1])
    if key in seen: continue
    seen.add(key)
    unique.append(r)

# Emit one big multi-row INSERT … ON CONFLICT update.
out.append("insert into hotties.facilities")
out.append("  (source_id, external_id, name, lat, lng, num_courts, category, region, phone, online_booking, facility_booking_url, tm_id, surface, lights, active)")
out.append("values")
chunks = []
for r in unique:
    src, ext, name, lat, lng, n, cat, rg, ph, ol, burl, tm = r
    line = (
        f"  ({sql_str(src)}, {sql_str(ext)}, {sql_str(name)}, "
        f"{lat}, {lng}, {n if n is not None else 'null'}, "
        f"{sql_str(cat)}, {sql_str(rg)}, {sql_str(ph)}, "
        f"{sql_bool(ol)}, {sql_str(burl)}, {tm if tm is not None else 'null'}, "
        f"'Hard', false, true)"
    )
    chunks.append(line)
out.append(',\n'.join(chunks))
out.append("on conflict (source_id, external_id) do update set")
out.append("  name = excluded.name,")
out.append("  lat = excluded.lat,")
out.append("  lng = excluded.lng,")
out.append("  num_courts = coalesce(excluded.num_courts, hotties.facilities.num_courts),")
out.append("  category = excluded.category,")
out.append("  region = excluded.region,")
out.append("  phone = coalesce(excluded.phone, hotties.facilities.phone),")
out.append("  online_booking = excluded.online_booking,")
out.append("  facility_booking_url = excluded.facility_booking_url,")
out.append("  tm_id = excluded.tm_id;")
out.append("")

# Stats summary as comments
from collections import Counter
src_counts = Counter(r[0] for r in unique)
out.append("-- Summary:")
for s, n in src_counts.most_common():
    out.append(f"--   {s:20s} {n:4d}")

open('/workspaces/HottiesThatHit/supabase/seed_la_courts_full.sql', 'w').write('\n'.join(out))
print(f'wrote {len(unique)} facility rows', file=sys.stderr)
