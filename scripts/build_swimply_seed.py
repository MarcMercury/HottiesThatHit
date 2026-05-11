#!/usr/bin/env python3
"""Generate supabase/seed_swimply.sql from /tmp/tennis/swimply_sm.json.

Swimply lists private-host tennis courts for hourly rental. Exact addresses
are revealed only after booking, so lat/lng/address are null. Listings are
keyed by Swimply's numeric id.
"""
from __future__ import annotations
import json, os, sys

IN_PATH = '/tmp/tennis/swimply_sm.json'
OUT_PATH = '/workspaces/HottiesThatHit/supabase/seed_swimply.sql'


def sql_str(s):
    if s is None or s == '':
        return 'null'
    return "'" + str(s).replace("'", "''") + "'"


def num(n):
    return 'null' if n is None else str(n)


def main() -> int:
    listings = json.load(open(IN_PATH))
    out: list[str] = []
    out.append('-- AUTO-GENERATED from swimply.com private tennis court listings.')
    out.append('-- Source script: scripts/build_swimply_seed.py')
    out.append('-- Private host rentals; exact addresses are revealed only after booking,')
    out.append('-- so lat/lng/address are null. Listings are tied to LA metro radius search.')
    out.append('')
    out.append('alter table hotties.facilities')
    out.append('  add column if not exists price_per_hour numeric,')
    out.append('  add column if not exists max_guests integer,')
    out.append('  add column if not exists rating numeric,')
    out.append('  add column if not exists reviews_count integer,')
    out.append('  add column if not exists listing_type text,')
    out.append('  add column if not exists cover_image_url text,')
    out.append('  add column if not exists description text;')
    out.append('')
    out.append("insert into hotties.sources (id, name, booking_url, scraper_type, enabled, notes) values")
    out.append("  ('swimply', 'Swimply', 'https://swimply.com/explore/santa-monica-ca-us/tennis-court', 'custom', false,")
    out.append("   'Private host rentals. Address revealed only after booking. Hourly pricing.')")
    out.append('on conflict (id) do update set')
    out.append('  name = excluded.name,')
    out.append('  booking_url = excluded.booking_url,')
    out.append('  notes = excluded.notes;')
    out.append('')
    out.append('insert into hotties.facilities')
    out.append('  (source_id, external_id, name, address, city, lat, lng, num_courts, surface,')
    out.append('   lights, active, category, region, online_booking, facility_booking_url, metro,')
    out.append('   price_per_hour, max_guests, rating, reviews_count, listing_type,')
    out.append('   cover_image_url, description)')
    out.append('values')
    rows = []
    for l in listings:
        rows.append(
            f"  ('swimply', {sql_str('swimply:' + l['id'])}, {sql_str(l['title'])}, null, "
            f"{sql_str(l.get('city'))}, null, null, 1, null, false, true, 'Private Rental', "
            f"{sql_str(l.get('city'))}, true, {sql_str(l.get('url'))}, 'LA', "
            f"{num(l.get('price_per_hour'))}, {num(l.get('max_guests'))}, "
            f"{num(l.get('rating'))}, {num(l.get('reviews_count'))}, "
            f"{sql_str(l.get('listing_type'))}, {sql_str(l.get('cover_image_url'))}, "
            f"{sql_str(l.get('description'))})"
        )
    out.append(',\n'.join(rows))
    out.append('on conflict (source_id, external_id) do update set')
    out.append('  name = excluded.name,')
    out.append('  city = excluded.city,')
    out.append('  facility_booking_url = excluded.facility_booking_url,')
    out.append('  price_per_hour = excluded.price_per_hour,')
    out.append('  max_guests = excluded.max_guests,')
    out.append('  rating = excluded.rating,')
    out.append('  reviews_count = excluded.reviews_count,')
    out.append('  listing_type = excluded.listing_type,')
    out.append('  cover_image_url = excluded.cover_image_url,')
    out.append('  description = excluded.description;')
    out.append('')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    open(OUT_PATH, 'w').write('\n'.join(out))
    print(f'wrote {OUT_PATH} ({len(rows)} listing rows)', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
