#!/usr/bin/env python3
"""Generate supabase/enrich_nyc_parks.sql from /tmp/tennis/nyc_parks.json.

Two-part output:
  1. Schema additions: park_url, park_name, is_indoor, accessible, facility_notes.
  2. UPSERT facilities under source_id='nyc_parks' keyed on a slugified name
     (external_id = 'nyc_parks:<slug>'). The existing NY seed already inserts
     a curated subset under the same source_id, so this file primarily fills
     in surface / indoor flag / authoritative court counts / notes / park
     URL / accessibility, and adds rows for facilities the tennismaps scrape
     missed (e.g. Sportime Randall's Island, McCarren, Stadium Tennis at
     Mill Pond).
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from textwrap import dedent

IN_PATH = '/tmp/tennis/nyc_parks.json'
OUT_PATH = '/workspaces/HottiesThatHit/supabase/enrich_nyc_parks.sql'

BOROUGH_REGION = {
    'Bronx': 'Bronx',
    'Brooklyn': 'Brooklyn',
    'Manhattan': 'Manhattan',
    'Queens': 'Queens',
    'Staten Island': 'Staten Island',
}

# nyc_parks facilities that are concession-run (3rd party tennis center) and
# bookable via that operator's site, not the citywide nyc_parks reservation.
CONCESSION_URLS = {
    'central park tennis center': 'https://www.nycgovparks.org/reg/tennis',
    'commonpoint queens tennis and athletic center at alley pond':
        'https://www.commonpointqueens.org/hours-locations/tennis/',
    'cunningham tennis center': 'https://cunninghamtennis.com/',
    'bensonhurst park': 'https://matchpoint.nyc/our-clubs/bensonhurst/',
    'mccarren tennis center': 'https://www.mccarrentennisnyc.com/',
    'prospect park tennis center': 'https://www.prospectpark.org/visit-the-park/places-to-go/tennis-center/',
    'cary leeds tennis center at crotona park': 'http://www.nyjtl.org/caryleeds/',
    'sportime at randall\'s island': 'https://www.sportimeny.com/manhattan',
    'sutton tennis at queensboro oval': 'https://www.suttoneasttennis.com',
    'stadium tennis center at mill pond park': 'http://www.stadiumtennisnyc.com/',
}


def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')[:80]


def norm(s: str) -> str:
    s = re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()
    # Strip common suffixes that vary between sources.
    for w in [' tennis center', ' tennis court', ' tennis courts', ' playground', ' park']:
        if s.endswith(w):
            s = s[: -len(w)].strip()
    return s


def sql_str(s):
    if s is None or s == '':
        return 'null'
    return "'" + str(s).replace("'", "''") + "'"


def sql_bool(b):
    if b is None:
        return 'null'
    return 'true' if b else 'false'


def main() -> int:
    courts = json.load(open(IN_PATH))
    out: list[str] = []
    out.append('-- AUTO-GENERATED from nycgovparks.org/facilities/tennis (NYC Parks tennis directory).')
    out.append('-- Source script: scripts/build_nyc_parks_enrichment.py')
    out.append('-- Enriches existing nyc_parks rows (surface, court counts, indoor flag, notes,')
    out.append('-- park URL, accessibility) and inserts any NYC Parks facilities missing from the')
    out.append('-- tennismaps-derived seed (concession-run indoor tennis centers in particular).')
    out.append('')
    out.append('-- 1. Schema additions (idempotent) ----------------------------------------')
    out.append(dedent('''\
        alter table hotties.facilities
          add column if not exists park_name text,
          add column if not exists park_url text,
          add column if not exists is_indoor boolean,
          add column if not exists accessible boolean,
          add column if not exists facility_notes text;
    '''))
    out.append('-- 2. nyc_parks source row (ensure present) --------------------------------')
    out.append(dedent('''\
        insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values
          ('nyc_parks', 'NYC Parks Tennis', 'https://www.nycgovparks.org/reg/tennis', 'nyc_parks_reg', false,
           'Citywide NYC Parks tennis reservation system. Permit-holder courts + concession-run indoor centers.')
        on conflict (id) do update set
          name = excluded.name,
          booking_url = excluded.booking_url,
          notes = excluded.notes;
    '''))

    out.append('-- 3. Facilities upsert ----------------------------------------------------')
    out.append("insert into hotties.facilities")
    out.append('  (source_id, external_id, name, address, lat, lng, num_courts, surface,')
    out.append('   lights, active, category, region, phone, online_booking, facility_booking_url,')
    out.append('   metro, park_name, park_url, is_indoor, accessible, facility_notes)')
    out.append('values')

    seen_keys: set[str] = set()
    rows: list[str] = []
    src_counts: Counter = Counter()
    for c in courts:
        name = c['name']
        key = f'nyc_parks:{slug(name)}'
        if key in seen_keys:
            # Multiple rows in the city table for the same name (e.g. Kissena
            # surface variants). Disambiguate with the borough+address slug.
            key = f'nyc_parks:{slug(name)}__{slug((c.get("address") or "")[:30])}'
            if key in seen_keys:
                continue
        seen_keys.add(key)

        borough = c.get('borough')
        region = BOROUGH_REGION.get(borough or '', borough)
        is_indoor = c.get('is_indoor')
        booking_url = CONCESSION_URLS.get(name.lower())
        if booking_url is None:
            # Default: citywide NYC Parks reservation system (outdoor permits).
            booking_url = 'https://www.nycgovparks.org/reg/tennis'
        online = True  # NYC Parks runs a citywide reservation system year-round.
        src_counts[borough or 'unknown'] += 1

        rows.append(
            f"  ('nyc_parks', {sql_str(key)}, {sql_str(name)}, {sql_str(c.get('address'))}, "
            f"null, null, {c['courts'] if c.get('courts') is not None else 'null'}, "
            f"{sql_str(c.get('surface'))}, false, true, 'Public Managed', "
            f"{sql_str(region)}, {sql_str(c.get('phone'))}, {sql_bool(online)}, "
            f"{sql_str(booking_url)}, 'NYC', {sql_str(c.get('park_name'))}, "
            f"{sql_str(c.get('park_url'))}, {sql_bool(is_indoor)}, "
            f"{sql_bool(c.get('accessible'))}, {sql_str(c.get('notes'))})"
        )

    out.append(',\n'.join(rows))
    out.append('on conflict (source_id, external_id) do update set')
    out.append('  name = excluded.name,')
    out.append('  address = coalesce(excluded.address, hotties.facilities.address),')
    out.append('  num_courts = coalesce(excluded.num_courts, hotties.facilities.num_courts),')
    out.append('  surface = coalesce(excluded.surface, hotties.facilities.surface),')
    out.append('  category = excluded.category,')
    out.append('  region = excluded.region,')
    out.append('  phone = coalesce(excluded.phone, hotties.facilities.phone),')
    out.append('  online_booking = excluded.online_booking,')
    out.append('  facility_booking_url = excluded.facility_booking_url,')
    out.append('  metro = excluded.metro,')
    out.append('  park_name = coalesce(excluded.park_name, hotties.facilities.park_name),')
    out.append('  park_url = coalesce(excluded.park_url, hotties.facilities.park_url),')
    out.append('  is_indoor = coalesce(excluded.is_indoor, hotties.facilities.is_indoor),')
    out.append('  accessible = coalesce(excluded.accessible, hotties.facilities.accessible),')
    out.append('  facility_notes = coalesce(excluded.facility_notes, hotties.facilities.facility_notes);')
    out.append('')
    out.append('-- Summary by borough:')
    for b, n in src_counts.most_common():
        out.append(f'--   {b:.<20} {n:4d}')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    open(OUT_PATH, 'w').write('\n'.join(out))
    print(f'wrote {OUT_PATH} ({len(rows)} facility rows)', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
