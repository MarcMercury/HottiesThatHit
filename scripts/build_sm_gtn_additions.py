#!/usr/bin/env python3
"""Generate supabase/seed_sm_gtn_additions.sql from /tmp/tennis/gtn_sm.json.

Filters Global Tennis Network's Santa Monica search to facilities in Santa
Monica or Pacific Palisades and emits inserts under source_id='santa_monica'
that won't collide with the existing seed (only Reed Park is currently in
seed_la_courts_full.sql for SM). Idempotent via on-conflict update.
"""
from __future__ import annotations
import json, os, re, sys

IN_PATH = '/tmp/tennis/gtn_sm.json'
EXISTING_SEED = '/workspaces/HottiesThatHit/supabase/seed_la_courts_full.sql'
OUT_PATH = '/workspaces/HottiesThatHit/supabase/seed_sm_gtn_additions.sql'

CITIES = {'Santa Monica', 'Pacific Palisades'}

# city -> (source_id, region)
SOURCE_BY_CITY = {
    'Santa Monica': ('santa_monica', 'Westside'),
    'Pacific Palisades': ('public_open', 'Westside'),
}

CATEGORY = {
    'Public': 'Public Open',
    'Club': 'Private Club',
    'School': 'School',
    'Private': 'Private',
}


def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')[:80]


def sql_str(s):
    if s is None or s == '':
        return 'null'
    return "'" + str(s).replace("'", "''") + "'"


def num(n):
    return 'null' if n in (None, '') else str(n)


def main() -> int:
    # Read existing seed to dedupe by full (source_id, slug) tuples.
    existing = set(re.findall(r"'([a-z_]+):([a-z0-9_-]+)'", open(EXISTING_SEED).read()))

    data = json.load(open(IN_PATH))
    rows = []
    skipped = []
    for c in data:
        if c['city'] not in CITIES:
            continue
        src, region = SOURCE_BY_CITY[c['city']]
        ext_slug = slug(c['name'])
        if (src, ext_slug) in existing:
            skipped.append(c['name'])
            continue
        cat = CATEGORY.get(c['type'], c['type'])
        address = ', '.join(p for p in [c.get('street'), c.get('city'), c.get('state')] if p)
        if c.get('zip'):
            address += ' ' + c['zip']
        rows.append({
            'src': src, 'ext_slug': ext_slug, 'name': c['name'], 'address': address,
            'city': c['city'], 'lat': c.get('lat'), 'lng': c.get('lng'),
            'courts': c.get('courts'), 'phone': c.get('phone'), 'category': cat,
            'region': region, 'gtn_id': c.get('gtn_id'),
            'indoor': bool(c.get('indoor')) if c.get('indoor') is not None else None,
        })

    out: list[str] = []
    out.append('-- AUTO-GENERATED from globaltennisnetwork.com city=Santa Monica search.')
    out.append('-- Source script: scripts/build_sm_gtn_additions.py')
    out.append('-- Adds Santa Monica + Pacific Palisades facilities missing from seed_la_courts_full.sql.')
    out.append('')
    out.append('alter table hotties.facilities')
    out.append('  add column if not exists gtn_id integer,')
    out.append('  add column if not exists is_indoor boolean;')
    out.append('')
    out.append('insert into hotties.facilities')
    out.append('  (source_id, external_id, name, address, city, lat, lng, num_courts, surface,')
    out.append('   lights, active, category, region, phone, metro, gtn_id, is_indoor)')
    out.append('values')
    sql_rows = []
    for r in rows:
        sql_rows.append(
            f"  ({sql_str(r['src'])}, {sql_str(r['src'] + ':' + r['ext_slug'])}, "
            f"{sql_str(r['name'])}, {sql_str(r['address'])}, {sql_str(r['city'])}, "
            f"{num(r['lat'])}, {num(r['lng'])}, {num(r['courts'])}, null, "
            f"false, true, {sql_str(r['category'])}, {sql_str(r['region'])}, "
            f"{sql_str(r['phone'])}, 'LA', {num(r['gtn_id'])}, "
            f"{'null' if r['indoor'] is None else ('true' if r['indoor'] else 'false')})"
        )
    out.append(',\n'.join(sql_rows))
    out.append('on conflict (source_id, external_id) do update set')
    out.append('  name = excluded.name,')
    out.append('  address = coalesce(excluded.address, hotties.facilities.address),')
    out.append('  lat = coalesce(excluded.lat, hotties.facilities.lat),')
    out.append('  lng = coalesce(excluded.lng, hotties.facilities.lng),')
    out.append('  num_courts = coalesce(excluded.num_courts, hotties.facilities.num_courts),')
    out.append('  phone = coalesce(excluded.phone, hotties.facilities.phone),')
    out.append('  category = excluded.category,')
    out.append('  region = excluded.region,')
    out.append('  metro = excluded.metro,')
    out.append('  gtn_id = coalesce(excluded.gtn_id, hotties.facilities.gtn_id),')
    out.append('  is_indoor = coalesce(excluded.is_indoor, hotties.facilities.is_indoor);')
    out.append('')
    out.append(f'-- Inserted: {len(rows)}; skipped (already in LA seed): {len(skipped)}')
    for s in skipped:
        out.append(f'--   skip: {s}')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    open(OUT_PATH, 'w').write('\n'.join(out))
    print(f'wrote {OUT_PATH} ({len(rows)} rows; skipped {len(skipped)})', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
