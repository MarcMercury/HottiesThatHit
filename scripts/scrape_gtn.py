#!/usr/bin/env python3
"""Scrape globaltennisnetwork.com for tennis courts in a city or state.

The site renders the list of courts via an internal AJAX endpoint and embeds
the full court directory inside the response as Google Maps `infoWindow`
content. Each marker block has the shape:

    courtPoints[N] = new google.maps.LatLng(LAT, LNG);
    courtMarkers[N] = new google.maps.Marker({..., icon: getIcon('TYPE',...)});
    courtMarkersIndexes[GTN_ID] = N;
    infoWindow.setContent('...
        <a href=".../court/GTN_ID-slug">NAME</a>...
        TYPE - X courts, Y indoor<br/>
        STREET<br/>
        CITY, STATE ZIP<br/>
        PHONE<br/>...');

Usage
-----
    scrape_gtn.py city <locationID> <lat> <lng> <out_slug>
    scrape_gtn.py state <stateID> <out_slug>

Examples
--------
    scrape_gtn.py city 884 34.0194543 -118.4911912 sm   # Santa Monica, CA
    scrape_gtn.py state 33 ny                            # New York

Output: /tmp/tennis/gtn_<slug>.json (list of court dicts).
"""
from __future__ import annotations

import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
ENDPOINT = 'https://www.globaltennisnetwork.com/index.php'
OUT_DIR = '/tmp/tennis'
PAGE_STEP = 50  # observed: each AJAX response returns up to 50 markers


def fetch(params: dict[str, str]) -> str:
    url = ENDPOINT + '?' + urllib.parse.urlencode(params)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
        return resp.read().decode('utf-8', errors='replace')


# Single regex per marker block: capture every relevant field at once.
# Note: HTML inside infoWindow is single-quoted; embedded apostrophes in
# names are JS-escaped as \' .
MARKER_RE = re.compile(
    r"courtPoints\[(?P<n>\d+)\]\s*=\s*new\s+google\.maps\.LatLng\("
    r"(?P<lat>-?[\d.]+),\s*(?P<lng>-?[\d.]+)\)\s*;"
    r".*?icon:\s*getIcon\('(?P<type>[^']+)',(?P<courts>[\d.]+),(?P<half>[\d.]+)\)"
    r".*?courtMarkersIndexes\[(?P<gtn_id>\d+)\]"
    r".*?infoWindow\.setContent\('(?P<info>(?:[^'\\]|\\.)*?)'\)\s*;",
    re.DOTALL,
)

INFO_RE = re.compile(
    r'/court/(?P<gtn_id>\d+)-(?P<slug>[a-z0-9-]+)">(?P<name>[^<]+)</a>.*?'
    r'(?P<type>Public|Club|School|Private)\s*-\s*(?P<courts>\d+)\s+courts?,\s*(?P<indoor>\d+)\s+indoor',
    re.DOTALL,
)

ADDR_RE = re.compile(
    r'(?P<indoor>\d+)\s+indoor<br/>'
    r'(?P<street>[^<]+)<br/>'
    r'(?P<city>[^,<]+),\s*(?P<state>[^<\d]+?)\s*(?P<zip>\d{5})?<br/>'
    r'(?:(?P<phone>\([\d)\s.\-]+[\d.\-\s]+)<br/>)?',
)

# Fallback: state-level results render an HTML table without map markers.
# Each row looks like:
#   <a href=".../court/GTN_ID-slug">NAME</a>
#   <div class="text-muted small">TYPE&nbsp;&nbsp;|&nbsp;&nbsp;Indoor/Outdoor[&nbsp;&nbsp;|&nbsp;&nbsp;Lights]</div>
#   <div class="my-1">STREET, CITY</div>
#   ...N court(s)
LIST_RE = re.compile(
    r'/court/(?P<gtn_id>\d+)-(?P<slug>[a-z0-9-]+)">(?P<name>[^<]+)</a>'
    r'.*?text-muted small">(?P<meta>[^<]+)</div>'
    r'.*?my-1">(?P<addr>[^<]+)</div>'
    r'.*?(?P<courts>\d+)\s+courts?',
    re.DOTALL,
)


def parse(html: str) -> list[dict]:
    rows: list[dict] = []
    for m in MARKER_RE.finditer(html):
        info = m.group('info').replace("\\'", "'").replace('\\/', '/').replace('\\"', '"')
        im = INFO_RE.search(info)
        if not im:
            continue
        am = ADDR_RE.search(info)
        rows.append({
            'gtn_id': int(im.group('gtn_id')),
            'slug': im.group('slug'),
            'name': im.group('name').strip(),
            'type': im.group('type'),
            'courts': int(im.group('courts')),
            'indoor': int(im.group('indoor')),
            'lat': float(m.group('lat')),
            'lng': float(m.group('lng')),
            'street': (am.group('street').strip() if am else None),
            'city': (am.group('city').strip() if am else None),
            'state': (am.group('state').strip() if am else None),
            'zip': (am.group('zip') if am else None),
            'phone': (am.group('phone').strip() if am and am.group('phone') else None),
        })
    if rows:
        return rows
    # Fallback: list-only response (state-level search has no map markers).
    for m in LIST_RE.finditer(html):
        meta_parts = [p.strip() for p in m.group('meta').replace('&nbsp;', ' ').split('|')]
        meta_parts = [p for p in meta_parts if p]
        ctype = meta_parts[0] if meta_parts else None
        is_indoor = any(p.lower() == 'indoor' for p in meta_parts[1:])
        addr = m.group('addr').strip()
        if ',' in addr:
            street, city = addr.rsplit(',', 1)
            street, city = street.strip(), city.strip()
        else:
            street, city = addr, None
        rows.append({
            'gtn_id': int(m.group('gtn_id')),
            'slug': m.group('slug'),
            'name': m.group('name').strip(),
            'type': ctype,
            'courts': int(m.group('courts')),
            'indoor': 1 if is_indoor else 0,  # boolean-ish, not a precise count
            'lat': None,
            'lng': None,
            'street': street,
            'city': city,
            'state': None,
            'zip': None,
            'phone': None,
        })
    return rows


def base_params(mode: str, **kw) -> dict[str, str]:
    p = {
        'option': 'com_tennissearch',
        'task': 'updateSearch',
        'format': 'raw',
        'Itemid': '94',
        'countryID': '',
        'stateID': '',
        'locationID': '',
        'radius': '15',
        'latitude': '',
        'longitude': '',
        'favorites': '',
        'start': '0',
        'searchType': '',
        'tab': 'courts',
        'courtType': '',
        'courtSurface': '',
        'noCourtFees': '',
        'courtSchedules': '',
        'courtLights': '',
        'courtIndoor': '',
        'courtOutdoor': '',
        'courtBackboard': '',
        'tennisSearch': '',
    }
    if mode == 'city':
        p['locationID'] = str(kw['location_id'])
        p['latitude'] = str(kw['lat'])
        p['longitude'] = str(kw['lng'])
        p['radius'] = str(kw.get('radius', 15))
    elif mode == 'state':
        p['stateID'] = str(kw['state_id'])
        p['radius'] = '0'
    else:
        raise ValueError(f'unknown mode {mode!r}')
    return p


def scrape(mode: str, out_slug: str, **kw) -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f'gtn_{out_slug}.json')
    seen: dict[int, dict] = {}
    start = 0
    empty_streak = 0
    while True:
        params = base_params(mode, **kw)
        params['start'] = str(start)
        print(f'  fetching start={start} ...', file=sys.stderr)
        html = fetch(params)
        rows = parse(html)
        new = 0
        for r in rows:
            if r['gtn_id'] in seen:
                continue
            seen[r['gtn_id']] = r
            new += 1
        print(f'    +{new} new ({len(rows)} parsed; {len(seen)} total)', file=sys.stderr)
        if new == 0:
            empty_streak += 1
            if empty_streak >= 2:
                break
        else:
            empty_streak = 0
        if len(rows) < PAGE_STEP and new == 0:
            break
        start += PAGE_STEP
        time.sleep(0.4)
        # safety stop
        if start > 50_000:
            print('warn: bailout at start=50000', file=sys.stderr)
            break

    courts = sorted(seen.values(), key=lambda c: (c['name'].lower(), c['gtn_id']))
    with open(out_path, 'w') as f:
        json.dump(courts, f, indent=2)
    print(f'wrote {out_path} ({len(courts)} courts)', file=sys.stderr)
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    mode = sys.argv[1]
    if mode == 'city':
        if len(sys.argv) < 6:
            print('usage: scrape_gtn.py city <locationID> <lat> <lng> <out_slug>', file=sys.stderr)
            return 2
        return scrape('city', sys.argv[5],
                      location_id=int(sys.argv[2]),
                      lat=float(sys.argv[3]),
                      lng=float(sys.argv[4]))
    if mode == 'state':
        if len(sys.argv) < 4:
            print('usage: scrape_gtn.py state <stateID> <out_slug>', file=sys.stderr)
            return 2
        return scrape('state', sys.argv[3], state_id=int(sys.argv[2]))
    print(f'unknown mode: {mode}', file=sys.stderr)
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
