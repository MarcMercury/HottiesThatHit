#!/usr/bin/env python3
"""Generate supabase/seed_ny_gtn_state.sql from /tmp/tennis/gtn_ny.json.

GTN's state-mode search returns ~2k NY facilities without lat/lng. This
builder uses 'gtn' as the source_id (universal Global Tennis Network source)
and external_id = 'gtn:<gtn_id>' so it never collides with curated regional
seeds. region is mapped from city; metro is 'NYC' for boroughs/LI/Westchester,
'BUF', 'ROC', 'SYR', 'ALB', else 'NY-other'.
"""
from __future__ import annotations
import json, os, sys
from collections import Counter

IN_PATH = '/tmp/tennis/gtn_ny.json'
OUT_PATH = '/workspaces/HottiesThatHit/supabase/seed_ny_gtn_state.sql'

NYC_CITIES = {
    'New York City': 'Manhattan', 'New York': 'Manhattan',
    'Brooklyn': 'Brooklyn', 'Bronx': 'Bronx', 'Queens': 'Queens',
    'Staten Island': 'Staten Island',
    'Astoria': 'Queens', 'Long Island City': 'Queens', 'Forest Hills': 'Queens',
    'Flushing': 'Queens', 'Jamaica': 'Queens', 'Jackson Heights': 'Queens',
    'Rego Park': 'Queens', 'Bayside': 'Queens', 'Elmhurst': 'Queens',
    'Woodside': 'Queens', 'Maspeth': 'Queens', 'Ridgewood': 'Queens',
    'Sunnyside': 'Queens', 'Far Rockaway': 'Queens', 'Whitestone': 'Queens',
    'Howard Beach': 'Queens', 'Ozone Park': 'Queens', 'College Point': 'Queens',
    'Rockaway Park': 'Queens', 'Glen Oaks': 'Queens', 'Douglaston': 'Queens',
    'Saint Albans': 'Queens', 'Hollis': 'Queens', 'Springfield Gardens': 'Queens',
    'Riverdale': 'Bronx', 'Throgs Neck': 'Bronx',
}

LI_COUNTIES = {  # Nassau + Suffolk
    'Great Neck', 'Manhasset', 'Roslyn', 'Garden City', 'Hempstead', 'Mineola',
    'Port Washington', 'Long Beach', 'Oceanside', 'Rockville Centre',
    'Valley Stream', 'Levittown', 'East Meadow', 'Westbury', 'Lynbrook',
    'Plainview', 'Syosset', 'Glen Cove', 'Hicksville', 'Massapequa',
    'Bethpage', 'Farmingdale', 'Old Westbury', 'Locust Valley', 'Sea Cliff',
    'Bayville', 'Oyster Bay', 'Floral Park', 'Woodmere', 'Cedarhurst',
    'Lawrence', 'Inwood', 'Atlantic Beach', 'Baldwin', 'Freeport', 'Merrick',
    'Wantagh', 'Seaford', 'New Hyde Park', 'Albertson', 'Carle Place',
    # Suffolk
    'Huntington', 'Smithtown', 'Stony Brook', 'Port Jefferson', 'Patchogue',
    'Bay Shore', 'Babylon', 'West Islip', 'Lindenhurst', 'Sayville',
    'Bohemia', 'Holbrook', 'Holtsville', 'Centereach', 'Selden',
    'Coram', 'Medford', 'Setauket', 'East Setauket', 'East Northport',
    'Northport', 'Cold Spring Harbor', 'Centerport', 'Greenlawn',
    'Commack', 'Hauppauge', 'Kings Park', 'Saint James', 'Nesconset',
    'Wading River', 'Riverhead', 'Southampton', 'East Hampton', 'Sag Harbor',
    'Bridgehampton', 'Water Mill', 'Westhampton', 'Westhampton Beach',
    'Quogue', 'Hampton Bays', 'Amagansett', 'Montauk', 'Greenport',
    'Southold', 'Cutchogue', 'Mattituck', 'Shelter Island', 'Shelter Island Heights',
    'Mastic', 'Mastic Beach', 'Shirley', 'Brookhaven', 'East Patchogue',
    'East Quogue', 'Sound Beach', 'Rocky Point', 'Miller Place',
    'Yaphank', 'Manorville', 'Calverton', 'Aquebogue',
    'Halesite', 'Lloyd Harbor', 'Asharoken', 'Eatons Neck',
    'Dix Hills', 'Melville', 'South Huntington',
    'Deer Park', 'Brentwood', 'Central Islip', 'Islip', 'East Islip',
    'Oakdale', 'Bayport', 'Blue Point', 'Ronkonkoma', 'Lake Grove',
}

WESTCHESTER = {
    'White Plains', 'New Rochelle', 'Yonkers', 'Mount Vernon', 'Scarsdale',
    'Rye', 'Harrison', 'Mamaroneck', 'Larchmont', 'Eastchester', 'Bronxville',
    'Tuckahoe', 'Pelham', 'Pelham Manor', 'Hartsdale', 'Ardsley', 'Dobbs Ferry',
    'Hastings on Hudson', 'Hastings-on-Hudson', 'Irvington', 'Tarrytown',
    'Sleepy Hollow', 'Briarcliff Manor', 'Pleasantville', 'Chappaqua',
    'Mount Kisco', 'Bedford', 'Bedford Hills', 'Katonah', 'Pound Ridge',
    'Cross River', 'Lewisboro', 'South Salem', 'Goldens Bridge', 'Somers',
    'Yorktown Heights', 'Mohegan Lake', 'Croton on Hudson', 'Croton-on-Hudson',
    'Ossining', 'Peekskill', 'Cortlandt Manor', 'Buchanan', 'Verplanck',
    'Port Chester', 'Rye Brook', 'Greenburgh', 'Elmsford', 'Valhalla',
    'North White Plains', 'Armonk', 'Purchase', 'Thornwood', 'Hawthorne',
    'Mount Pleasant', 'New Castle',
}

METRO_REGION_FOR_CITY = {
    'Rochester': ('ROC', 'Rochester'),
    'Syracuse': ('SYR', 'Syracuse'),
    'Buffalo': ('BUF', 'Buffalo'),
    'Albany': ('ALB', 'Albany'),
    'Schenectady': ('ALB', 'Capital'),
    'Troy': ('ALB', 'Capital'),
    'Saratoga Springs': ('ALB', 'Capital'),
    'Binghamton': ('NY-other', 'Southern Tier'),
    'Utica': ('NY-other', 'Mohawk Valley'),
    'Rome': ('NY-other', 'Mohawk Valley'),
    'Poughkeepsie': ('NY-other', 'Hudson Valley'),
    'Kingston': ('NY-other', 'Hudson Valley'),
    'Newburgh': ('NY-other', 'Hudson Valley'),
    'Middletown': ('NY-other', 'Hudson Valley'),
    'Ithaca': ('NY-other', 'Finger Lakes'),
    'Niagara Falls': ('BUF', 'Buffalo'),
    'Jamestown': ('NY-other', 'Western NY'),
}

CATEGORY = {
    'Public': 'Public Open',
    'Club': 'Private Club',
    'School': 'School',
    'Private': 'Private',
}


def sql_str(s):
    if s is None or s == '':
        return 'null'
    return "'" + str(s).replace("'", "''") + "'"


def num(n):
    return 'null' if n in (None, '') else str(n)


def classify(city: str | None):
    if not city:
        return ('NY-other', 'Unknown')
    if city in NYC_CITIES:
        return ('NYC', NYC_CITIES[city])
    if city in LI_COUNTIES:
        return ('NYC', 'Long Island')
    if city in WESTCHESTER:
        return ('NYC', 'Westchester')
    if city in METRO_REGION_FOR_CITY:
        return METRO_REGION_FOR_CITY[city]
    return ('NY-other', city)


def main() -> int:
    data = json.load(open(IN_PATH))
    out: list[str] = []
    out.append('-- AUTO-GENERATED from globaltennisnetwork.com NY state search.')
    out.append('-- Source script: scripts/build_ny_gtn_state.py')
    out.append('-- Statewide directory of 2k+ NY tennis facilities (Public/Club/School/Private).')
    out.append('-- No lat/lng available from the state-mode listing.')
    out.append('-- Uses source_id=\'gtn\' so it never collides with curated regional seeds.')
    out.append('')
    out.append('alter table hotties.facilities')
    out.append('  add column if not exists gtn_id integer,')
    out.append('  add column if not exists is_indoor boolean;')
    out.append('')
    out.append("insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values")
    out.append("  ('gtn', 'Global Tennis Network', 'https://www.globaltennisnetwork.com/', 'static', false,")
    out.append("   'Crowdsourced tennis facility directory. Used for state-wide coverage where")
    out.append("    curated sources are unavailable; no lat/lng or booking integration.')")
    out.append('on conflict (id) do update set')
    out.append('  name = excluded.name,')
    out.append('  booking_url = excluded.booking_url,')
    out.append('  notes = excluded.notes;')
    out.append('')
    out.append('insert into hotties.facilities')
    out.append('  (source_id, external_id, name, address, city, lat, lng, num_courts, surface,')
    out.append('   lights, active, category, region, phone, metro, gtn_id, is_indoor)')
    out.append('values')

    seen = set()
    rows = []
    metro_counts: Counter = Counter()
    type_counts: Counter = Counter()
    for c in data:
        gid = c.get('gtn_id')
        if gid is None or gid in seen:
            continue
        seen.add(gid)
        metro, region = classify(c.get('city'))
        cat = CATEGORY.get(c.get('type'), c.get('type'))
        address_parts = [c.get('street'), c.get('city'), c.get('state')]
        address = ', '.join(p for p in address_parts if p)
        if c.get('zip'):
            address = (address + ' ' + c['zip']).strip()
        if not address:
            address = None
        indoor = c.get('indoor')
        rows.append(
            f"  ('gtn', {sql_str('gtn:' + str(gid))}, {sql_str(c['name'])}, "
            f"{sql_str(address)}, {sql_str(c.get('city'))}, null, null, "
            f"{num(c.get('courts'))}, null, false, true, {sql_str(cat)}, "
            f"{sql_str(region)}, {sql_str(c.get('phone'))}, {sql_str(metro)}, "
            f"{gid}, {'null' if indoor is None else ('true' if indoor else 'false')})"
        )
        metro_counts[metro] += 1
        type_counts[c.get('type') or 'Unknown'] += 1

    out.append(',\n'.join(rows))
    out.append('on conflict (source_id, external_id) do update set')
    out.append('  name = excluded.name,')
    out.append('  address = coalesce(excluded.address, hotties.facilities.address),')
    out.append('  city = coalesce(excluded.city, hotties.facilities.city),')
    out.append('  num_courts = coalesce(excluded.num_courts, hotties.facilities.num_courts),')
    out.append('  category = excluded.category,')
    out.append('  region = excluded.region,')
    out.append('  phone = coalesce(excluded.phone, hotties.facilities.phone),')
    out.append('  metro = excluded.metro,')
    out.append('  gtn_id = excluded.gtn_id,')
    out.append('  is_indoor = coalesce(excluded.is_indoor, hotties.facilities.is_indoor);')
    out.append('')
    out.append(f'-- Total: {len(rows)} facilities')
    out.append('-- By metro:')
    for m, n in metro_counts.most_common():
        out.append(f'--   {m:.<12} {n:5d}')
    out.append('-- By type:')
    for t, n in type_counts.most_common():
        out.append(f'--   {t:.<12} {n:5d}')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    open(OUT_PATH, 'w').write('\n'.join(out))
    print(f'wrote {OUT_PATH} ({len(rows)} rows)', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
