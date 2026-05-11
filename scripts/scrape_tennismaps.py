#!/usr/bin/env python3
"""Scrape a tennismaps.com region (default: 104, greater LA) and emit
/tmp/tennis/tennismaps_<slug>.json — the input file consumed by the
build_*_courts_seed.py scripts.

Usage: scrape_tennismaps.py [region_id] [out_slug]
    region_id : int  (default 104 = LA; 146 = NYC)
    out_slug  : str  (default 'la'; produces tennismaps_<slug>.json)

Why this exists
---------------
tennismaps.com renders the entire region as a single HTML page that embeds the
full court directory inline as a JavaScript `locations` array. There is no
public JSON endpoint, so we fetch the HTML and parse the array with regex.

Each `locations[i]` row from the page has this shape:
    [0]=lat, [1]=lng, [2]=description, [3]=tm_id, [4..6]=icon,
    [7]=type ("TENNIS_COURT_INFO"), [8]=extra
The description is a single string of the form
    "Name, N Courts (Category) - <a href=\"tel:...\">phone</a>"
with the trailing phone fragment optional.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

REGION_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 104
OUT_SLUG = sys.argv[2] if len(sys.argv) > 2 else 'la'
URL = f'https://www.tennismaps.com/index.asp?regionid={REGION_ID}'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
OUT_DIR = '/tmp/tennis'
OUT_PATH = os.path.join(OUT_DIR, f'tennismaps_{OUT_SLUG}.json')
HTML_PATH = os.path.join(OUT_DIR, f'region{REGION_ID}.html')


def fetch_html() -> str:
    # tennismaps.com currently serves an expired TLS cert; verify=False is intentional.
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(URL, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        raw = resp.read()
    # Page is ascii but contains a few non-utf8 bytes in unrelated copy.
    return raw.decode('latin-1')


def parse(html: str) -> list[dict]:
    # Each property assignment lives on the same giant line; use targeted regex
    # per index rather than splitting the JS.
    field_re = {
        'lat':   re.compile(r'locations\[(\d+)\]\[0\]\s*=\s*([\-0-9.]+)'),
        'lng':   re.compile(r'locations\[(\d+)\]\[1\]\s*=\s*([\-0-9.]+)'),
        'desc':  re.compile(r'locations\[(\d+)\]\[2\]\s*=\s*"((?:[^"\\]|\\.)*)"'),
        'tm_id': re.compile(r'locations\[(\d+)\]\[3\]\s*=\s*(\d+)'),
        'type':  re.compile(r'locations\[(\d+)\]\[7\]\s*=\s*"([^"]+)"'),
    }

    rows: dict[int, dict] = {}
    for key, rx in field_re.items():
        for m in rx.finditer(html):
            idx = int(m.group(1))
            rows.setdefault(idx, {})[key] = m.group(2)

    desc_re = re.compile(
        r'^(?P<name>.+?),\s*(?P<courts>\d+)\s+Courts?\s*\((?P<category>[^)]+)\)'
        r'(?:\s*-\s*<a[^>]*tel:(?P<phone>[^"\\]+)\\?"[^>]*>.*?</a>)?\s*$'
    )

    out: list[dict] = []
    for idx in sorted(rows):
        r = rows[idx]
        if r.get('type') != 'TENNIS_COURT_INFO':
            continue
        desc = (r.get('desc') or '').replace('\\"', '"').replace('\\/', '/')
        m = desc_re.match(desc)
        if not m:
            # Fallback: try without the courts/category pattern (very rare).
            print(f'warn: could not parse description for tm_id={r.get("tm_id")}: {desc!r}', file=sys.stderr)
            continue
        out.append({
            'tm_id': int(r['tm_id']),
            'name': m.group('name').strip(),
            'courts': int(m.group('courts')),
            'category': m.group('category').strip(),
            'phone': (m.group('phone') or '').strip() or None,
            'lat': float(r['lat']),
            'lng': float(r['lng']),
        })
    return out


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f'fetching {URL} ...', file=sys.stderr)
    html = fetch_html()
    with open(HTML_PATH, 'w', encoding='latin-1') as f:
        f.write(html)
    print(f'  saved {HTML_PATH} ({len(html):,} chars)', file=sys.stderr)

    courts = parse(html)
    print(f'parsed {len(courts)} tennis courts', file=sys.stderr)

    from collections import Counter
    cats = Counter(c['category'] for c in courts)
    for cat, n in cats.most_common():
        print(f'  {cat:.<30} {n}', file=sys.stderr)

    courts.sort(key=lambda c: (c['name'].lower(), c['tm_id']))
    with open(OUT_PATH, 'w') as f:
        json.dump(courts, f, indent=2)
    print(f'wrote {OUT_PATH}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
