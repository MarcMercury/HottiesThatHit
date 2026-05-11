#!/usr/bin/env python3
"""Scrape https://swimply.com/explore/<location>/tennis-court — Swimply's
private-host tennis court listings for a given city (e.g. Santa Monica).

Notes
-----
- Swimply listings are private/host-rented courts. Public detail pages do
  NOT expose street addresses or coordinates (those are revealed only after
  a confirmed booking). Each listing's `city` and `distance` (from search
  centroid) are the only location signals available to us.
- The page is server-rendered by Next.js. The full search payload sits in
  the streamed `self.__next_f.push([1, "..."])` chunks. We concatenate the
  chunks and slice out the `SearchPool` listing objects with regex.

Usage
-----
    scrape_swimply.py <location_slug> [out_slug]

Example
-------
    scrape_swimply.py us-ca-santa-monica sm   # writes /tmp/tennis/swimply_sm.json
"""
from __future__ import annotations

import json
import os
import re
import ssl
import sys
import urllib.request

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
OUT_DIR = '/tmp/tennis'

CHUNK_RE = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')
LISTING_RE = re.compile(
    r'"__typename":"SearchPool","id":"(?P<id>\d+)",'
    r'"cover_image_url":"(?P<cover>[^"]*)",'
    r'"title":"(?P<title>(?:[^"\\]|\\.)*)",'
    r'"description":"(?P<description>(?:[^"\\]|\\.)*)",'
    r'"reviewsCount":(?P<reviews>\d+),'
    r'"rating":(?P<rating>[\d.]+),'
    r'"country_code":"(?P<country>[^"]+)",'
    r'"listing_type":"(?P<listing_type>[^"]+)",'
    r'"city":"(?P<city>[^"]*)",'
    r'"state":"(?P<state>[^"]*)",'
    r'"distance":(?P<distance>[\d.]+),'
    r'"pricing":\{[^}]*"price":(?P<price>[\d.]+),'
    r'[^}]*"pricing_scheme":"(?P<scheme>[^"]+)"[^}]*\},'
    r'"is_quality":(?P<quality>true|false),'
    r'"max_guests":(?P<max_guests>\d+)'
)


def fetch(slug: str) -> str:
    url = f'https://swimply.com/explore/{slug}/tennis-court'
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse(html: str) -> list[dict]:
    chunks = CHUNK_RE.findall(html)
    # Each chunk is a JSON-string-escaped fragment of the streamed RSC payload.
    # Use json.loads to decode escapes correctly (handles \uXXXX -> unicode).
    payload = ''.join(json.loads(f'"{c}"') for c in chunks)
    seen: set[str] = set()
    listings: list[dict] = []
    for m in LISTING_RE.finditer(payload):
        lid = m.group('id')
        if lid in seen:
            continue
        seen.add(lid)
        listings.append({
            'id': lid,
            'url': f'https://swimply.com/p/{lid}',  # canonical Swimply listing URL
            'title': json.loads(f'"{m.group("title")}"'),
            'description': json.loads(f'"{m.group("description")}"'),
            'cover_image_url': m.group('cover'),
            'reviews_count': int(m.group('reviews')),
            'rating': float(m.group('rating')),
            'country_code': m.group('country'),
            'listing_type': m.group('listing_type'),
            'city': m.group('city'),
            'state': m.group('state'),
            'distance_miles': float(m.group('distance')),
            'price_per_hour': float(m.group('price')),
            'pricing_scheme': m.group('scheme'),
            'is_quality': m.group('quality') == 'true',
            'max_guests': int(m.group('max_guests')),
        })
    return listings


def main() -> int:
    if len(sys.argv) < 2:
        print('usage: scrape_swimply.py <location_slug> [out_slug]', file=sys.stderr)
        return 2
    location = sys.argv[1]
    out_slug = sys.argv[2] if len(sys.argv) > 2 else location.split('-')[-1]
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f'swimply_{out_slug}.json')
    print(f'fetching swimply: {location} ...', file=sys.stderr)
    html = fetch(location)
    listings = parse(html)
    print(f'parsed {len(listings)} listings', file=sys.stderr)
    listings.sort(key=lambda r: r['distance_miles'])
    with open(out_path, 'w') as f:
        json.dump(listings, f, indent=2)
    print(f'wrote {out_path}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
