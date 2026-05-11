#!/usr/bin/env python3
"""Generate supabase/seed_ny_courts_full.sql from /tmp/tennis/tennismaps_nyc.json,
enriched with hand-curated booking metadata for known NYC-area online systems.

Mirrors scripts/build_la_courts_seed.py, scoped to tennismaps regionid=146
(New York, NY). Seed adds the `metro` column to hotties.facilities and tags
NYC-area rows with metro='NYC'. Existing LA rows are backfilled to metro='LA'.
"""
import json, re, sys
from textwrap import dedent
from collections import Counter

courts = json.load(open('/tmp/tennis/tennismaps_nyc.json'))

# ---- known booking systems (manual curation) -------------------------------
# Maps a tennismaps name -> (source_id, online_booking, booking_url, override_external_id?)
BOOKING_OVERRIDES = {
    # NYC Parks-managed reservable centers (single citywide reservation system)
    'Central Park Tennis Center':         ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:central_park'),
    'Astoria Park':                       ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:astoria_park'),
    'Cunningham Tennis Center':           ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:cunningham'),
    'Crocheron Park':                     ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:crocheron'),
    'Forest Park Tennis Court':           ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:forest_park'),
    'Juniper Valley Park':                ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:juniper_valley'),
    'Kissena Park':                       ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:kissena'),
    'Riverside Park':                     ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:riverside_park'),
    'Riverside Park Clay Tennis Courts':  ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:riverside_clay'),
    'Marine Park Tennis Center':          ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:marine_park'),
    'Lincoln Terrace Park':               ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:lincoln_terrace'),
    'Manhattan Beach Park':               ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:manhattan_beach'),
    'Leon S Kaiser Park':                 ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:kaiser_park'),
    'Sunnyside Garden Park':              ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:sunnyside_garden'),
    'Flushing Fields Memorial':           ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:flushing_meadows'),
    'Baisley South Park':                 ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:baisley_south'),
    'Bayswater Park':                     ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:bayswater'),
    'Haffen Park':                        ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:haffen'),
    'Middletown Rd- Pelham Bay Park':     ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:pelham_bay_middletown'),
    'Orchard Beach - Pelham Bay Park':    ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:pelham_bay_orchard'),
    'St James Park':                      ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:st_james'),
    'Walker Park':                        ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:walker_park'),
    'Silver Lake Park':                   ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:silver_lake'),
    'Lincoln Park Tennis Center':         ('nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks:lincoln_park'),

    # Independent / non-profit reservable centers
    'USTA Billie Jean King National Tennis Center': ('usta_bjk', True, 'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html', 'usta_bjk:ntc'),
    'Cary Leeds Tennis Center':           ('nyjtl', True, 'https://nyjtl.org/cary-leeds-center/', 'nyjtl:cary_leeds'),
    'Prospect Park Tennis Center':        ('cityparks', True, 'https://www.cityparksfoundation.org/sports/prospect-park-tennis-center/', 'cityparks:prospect_park'),
    'McDonald Park Youth Tennis Center':  ('nyjtl', True, 'https://nyjtl.org/', 'nyjtl:mcdonald_park'),
    'Harlem Tennis Center':               ('nyjtl', True, 'https://nyjtl.org/', 'nyjtl:harlem'),
    'Alley Pond Tennis Center':           ('alley_pond', True, 'https://alleypondtennis.com/', 'alley_pond:main'),

    # Long Island — Nassau County parks
    'Eisenhower Park':                    ('nassau_parks', True, 'https://www.nassaucountyny.gov/2961/Tennis', 'nassau_parks:eisenhower'),
    'Bethpage Park Tennis Center':        ('bethpage_state', True, 'https://parks.ny.gov/parks/27/details.aspx', 'nys_parks:bethpage'),
    'Wantagh Park':                       ('nassau_parks', True, 'https://www.nassaucountyny.gov/2961/Tennis', 'nassau_parks:wantagh'),
    'Michael J Tully Park':               ('north_hempstead', True, 'https://www.northhempsteadny.gov/parks-and-recreation', 'nh:tully'),
    'North Woodmere Park':                ('nassau_parks', True, 'https://www.nassaucountyny.gov/2961/Tennis', 'nassau_parks:north_woodmere'),
    'Cow Meadow Park':                    ('nassau_parks', True, 'https://www.nassaucountyny.gov/2961/Tennis', 'nassau_parks:cow_meadow'),
    'Hempstead Lake State Park':          ('nys_parks', True, 'https://parks.ny.gov/', 'nys_parks:hempstead_lake'),

    # Westchester
    'Anthony F Veteran Park':             ('westchester_parks', True, 'https://parks.westchestergov.com/sports', 'westchester:anthony_veteran'),
    'Gillie Park':                        ('westchester_parks', True, 'https://parks.westchestergov.com/sports', 'westchester:gillie'),
    'MT Vernon Tennis Center':            ('westchester_parks', True, 'https://parks.westchestergov.com/sports', 'westchester:mt_vernon'),
    'Bronxville Village Tennis Courts':   ('bronxville', True, 'https://www.villageofbronxville.com/recreation', 'bronxville:village'),
    'Rye Recreation Park':                ('rye_rec', True, 'https://www.ryeny.gov/departments/recreation', 'rye:rec_park'),
    'Scalzi Park Tennis Center':          ('stamford_rec', True, 'https://www.stamfordct.gov/government/departments/recreation-services', 'stamford:scalzi'),
    'Flint Park':                         ('larchmont_rec', True, 'https://www.villageoflarchmont.org/recreation', 'larchmont:flint'),

    # Northern New Jersey (in NYC tennismaps region)
    'Althea Gibson Tennis Center':        ('njsea', True, 'https://www.njsea.com/', 'nj:althea_gibson'),
    'Brookdale Park':                     ('essex_parks', True, 'https://www.essexcountynj.org/parks/', 'essex:brookdale'),
    'North Hudson Park':                  ('hudson_parks', True, 'https://www.hudsoncountynj.org/parks/', 'hudson:north_hudson'),
    'Nishuane Park':                      ('montclair_rec', True, 'https://www.montclairnjusa.org/government/departments-divisions/recreation-cultural-affairs', 'montclair:nishuane'),
    'Wayne Tennis Complex':               ('wayne_rec', True, 'https://www.waynetownship.com/government/departments/parks-recreation', 'wayne:tennis'),

    # Private / club  with public-access pickup info
    'Roton Point Association':            ('private_club', False, None, None),
    'Westport Longshore Club':            ('private_club', False, None, None),
    'Holmdel Swim & Tennis Center':       ('private_club', False, None, None),
    'Oak Hills Tennis Club':              ('private_club', False, None, None),
}


# ---- region heuristic from lat/lng (NYC-area boroughs/counties) ------------
def region(p):
    lat, lng = p['lat'], p['lng']
    # Manhattan
    if 40.70 <= lat <= 40.88 and -74.02 <= lng <= -73.91: return 'Manhattan'
    # Bronx
    if 40.78 <= lat <= 40.93 and -73.93 <= lng <= -73.76: return 'Bronx'
    # Brooklyn
    if 40.55 <= lat <= 40.74 and -74.05 <= lng <= -73.85: return 'Brooklyn'
    # Queens
    if 40.54 <= lat <= 40.80 and -73.96 <= lng <= -73.70: return 'Queens'
    # Staten Island
    if 40.48 <= lat <= 40.65 and -74.26 <= lng <= -74.05: return 'Staten Island'
    # Long Island (Nassau / Suffolk)
    if 40.55 <= lat <= 41.00 and -73.70 <= lng <= -72.50: return 'Long Island'
    # Westchester / lower CT
    if 40.91 <= lat <= 41.40 and -73.90 <= lng <= -73.20: return 'Westchester / CT'
    # Northern NJ
    if 40.45 <= lat <= 41.10 and -74.85 <= lng <= -74.00: return 'Northern NJ'
    # Hudson / Bergen waterfront NJ
    if 40.65 <= lat <= 41.00 and -74.05 <= lng <= -73.95: return 'Northern NJ'
    return 'NYC Metro'


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')[:60]


# ---- decide which to seed --------------------------------------------------
KEEP_CATEGORIES = {'Public Open', 'Public Managed'}
seeded = [c for c in courts if c['category'] in KEEP_CATEGORIES]
print(f'seeding {len(seeded)} NYC-area courts', file=sys.stderr)


# ---- emit SQL --------------------------------------------------------------
def sql_str(s):
    if s is None or s == '':
        return 'null'
    return "'" + str(s).replace("'", "''") + "'"


def sql_bool(b):
    return 'true' if b else 'false'


out = []
out.append("-- AUTO-GENERATED from tennismaps.com regionid=146 (New York, NY) + curated booking metadata.")
out.append("-- Source script: scripts/build_ny_courts_seed.py")
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
  add column if not exists facility_booking_url text,
  add column if not exists metro text;

create index if not exists facilities_metro_idx on hotties.facilities (metro);
create index if not exists facilities_category_idx on hotties.facilities (category);
create index if not exists facilities_region_idx on hotties.facilities (region);
create index if not exists facilities_online_booking_idx on hotties.facilities (online_booking);

-- Backfill existing LA rows so the metro filter works for legacy data.
update hotties.facilities
  set metro = 'LA'
  where metro is null
    and (region in (
      'San Fernando Valley','Northeast LA / SGV','Westside','South Bay',
      'Long Beach / Cerritos','Central LA','San Gabriel Valley','Greater LA'
    ) or source_id in (
      'la_rec','la_county','long_beach','lakewood','manhattan_beach',
      'redondo_beach','el_segundo','calabasas','glendale','san_marino',
      'cerritos','la_mirada','downey','whittier','beverly_hills','ucla',
      'public_open','santa_monica','culver_city','pasadena','burbank'
    ));
"""))

out.append("-- 2. Sources --------------------------------------------------------------")
out.append(dedent("""\
insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
  ('nyc_parks',         'NYC Parks Tennis',                'https://www.nycgovparks.org/reg/tennis',                                       'nyc_parks_reg', false, 'Citywide NYC Parks tennis reservation system. Single-play permit + court reservations across all five boroughs.'),
  ('usta_bjk',          'USTA Billie Jean King NTC',       'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html', 'custom', false, 'Flushing Meadows. 22 outdoor + indoor hard / clay. Public reservations via NTC website.'),
  ('nyjtl',             'New York Junior Tennis & Learning', 'https://nyjtl.org/',                                                          'custom', false, 'Cary Leeds (Bronx), Harlem TC, McDonald Park, after-school programs.'),
  ('cityparks',         'City Parks Foundation',           'https://www.cityparksfoundation.org/sports/',                                  'custom', false, 'Operates Prospect Park Tennis Center and Central Park youth programs.'),
  ('alley_pond',        'Alley Pond Tennis (Queens)',      'https://alleypondtennis.com/',                                                 'custom', false, 'Indoor/outdoor club at Alley Pond Park, Queens.'),
  ('nassau_parks',      'Nassau County Parks',             'https://www.nassaucountyny.gov/2961/Tennis',                                   'custom', false, 'Long Island county parks. Eisenhower, Wantagh, North Woodmere, Cow Meadow.'),
  ('north_hempstead',   'Town of North Hempstead',         'https://www.northhempsteadny.gov/parks-and-recreation',                        'custom', false, 'Tully Park and town tennis courts.'),
  ('bethpage_state',    'NY State Parks - Bethpage',       'https://parks.ny.gov/parks/27/details.aspx',                                   'custom', false, 'Bethpage State Park Tennis Center.'),
  ('nys_parks',         'New York State Parks',            'https://parks.ny.gov/',                                                        'custom', false, 'State park tennis facilities.'),
  ('westchester_parks', 'Westchester County Parks',        'https://parks.westchestergov.com/sports',                                      'custom', false, 'Anthony Veteran (Yonkers), Mt Vernon, Saxon Woods, Tibbetts Brook.'),
  ('bronxville',        'Village of Bronxville',           'https://www.villageofbronxville.com/recreation',                               'custom', false, 'Bronxville Village resident tennis.'),
  ('rye_rec',           'City of Rye Recreation',          'https://www.ryeny.gov/departments/recreation',                                 'custom', false, 'Rye Recreation Park tennis.'),
  ('stamford_rec',      'Stamford Recreation',             'https://www.stamfordct.gov/government/departments/recreation-services',        'custom', false, 'Scalzi Park TC.'),
  ('larchmont_rec',     'Village of Larchmont Recreation', 'https://www.villageoflarchmont.org/recreation',                                'custom', false, 'Flint Park tennis.'),
  ('njsea',             'NJ Sports & Exposition Authority','https://www.njsea.com/',                                                       'custom', false, 'Althea Gibson TC, Meadowlands.'),
  ('essex_parks',       'Essex County Parks (NJ)',         'https://www.essexcountynj.org/parks/',                                         'custom', false, 'Brookdale Park and other Essex parks.'),
  ('hudson_parks',      'Hudson County Parks (NJ)',        'https://www.hudsoncountynj.org/parks/',                                        'custom', false, 'North Hudson Park, James J Braddock.'),
  ('montclair_rec',     'Montclair Recreation',            'https://www.montclairnjusa.org/government/departments-divisions/recreation-cultural-affairs', 'custom', false, 'Nishuane Park and Montclair township courts.'),
  ('wayne_rec',         'Wayne Township Parks (NJ)',       'https://www.waynetownship.com/government/departments/parks-recreation',        'custom', false, 'Wayne Tennis Complex.'),
  ('private_club',      'Private clubs (members only)',    'https://www.tennismaps.com/index.asp?regionid=146',                            'static',        false, 'Membership-required clubs surfaced for context. Not bookable here.'),
  ('public_open_nyc',   'NYC-area free park courts',       'https://www.nycgovparks.org/permits/tennis-permits',                           'static',        false, 'First-come / drop-in courts. NYC city courts require a $100 annual or $15 single-play permit; suburban park courts vary.')
on conflict (id) do update set
  name = excluded.name,
  booking_url = excluded.booking_url,
  scraper_type = excluded.scraper_type,
  notes = excluded.notes;
"""))

out.append("-- 3. Facilities ---------------------------------------------------------")
out.append("-- Each row sourced from tennismaps.com region 146 (NYC). Lat/lng verified by tennismaps; addresses to geocode later.")
out.append("")

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

    override = None
    for key, val in BOOKING_OVERRIDES.items():
        if key.lower() == name.lower():
            override = val
            break

    if override:
        if len(override) == 4 and override[3]:
            source_id, online, burl, ext = override[0], override[1], override[2], override[3]
        else:
            source_id, online, burl = override[0], override[1], override[2]
            ext = f'{source_id}:{slug(name)}'
    elif cat == 'Public Open':
        source_id, online, burl = 'public_open_nyc', False, None
        ext = f'{source_id}:{slug(name)}'
    else:
        # Public Managed without explicit override — within NYC city limits
        # default to nyc_parks reservation; otherwise fall back to public_open_nyc
        # (info link only, no online booking).
        if rg in ('Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'):
            source_id, online, burl = 'nyc_parks', True, 'https://www.nycgovparks.org/reg/tennis'
        else:
            source_id, online, burl = 'public_open_nyc', False, None
        ext = f'{source_id}:{slug(name)}_{tm_id}'

    rows.append((source_id, ext, name, lat, lng, courts_n, cat, rg, phone, online, burl, tm_id))

# Dedupe by (source_id, ext)
seen = set()
unique = []
for r in rows:
    key = (r[0], r[1])
    if key in seen: continue
    seen.add(key)
    unique.append(r)

out.append("insert into hotties.facilities")
out.append("  (source_id, external_id, name, lat, lng, num_courts, category, region, phone, online_booking, facility_booking_url, tm_id, surface, lights, active, metro)")
out.append("values")
chunks = []
for r in unique:
    src, ext, name, lat, lng, n, cat, rg, ph, ol, burl, tm = r
    line = (
        f"  ({sql_str(src)}, {sql_str(ext)}, {sql_str(name)}, "
        f"{lat}, {lng}, {n if n is not None else 'null'}, "
        f"{sql_str(cat)}, {sql_str(rg)}, {sql_str(ph)}, "
        f"{sql_bool(ol)}, {sql_str(burl)}, {tm if tm is not None else 'null'}, "
        f"'Hard', false, true, 'NYC')"
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
out.append("  tm_id = excluded.tm_id,")
out.append("  metro = excluded.metro;")
out.append("")

src_counts = Counter(r[0] for r in unique)
out.append("-- Summary:")
for s, n in src_counts.most_common():
    out.append(f"--   {s:20s} {n:4d}")

open('/workspaces/HottiesThatHit/supabase/seed_ny_courts_full.sql', 'w').write('\n'.join(out))
print(f'wrote {len(unique)} NYC facility rows', file=sys.stderr)
