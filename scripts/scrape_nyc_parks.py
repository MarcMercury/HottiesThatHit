#!/usr/bin/env python3
"""Scrape https://www.nycgovparks.org/facilities/tennis — the canonical
list of NYC Parks-managed tennis facilities, organized by borough.

The page contains five borough tables (Bronx, Brooklyn, Manhattan, Queens,
Staten Island) inside `<div id="tab-{X|B|M|Q|R}">`. Each `<tr>` row carries
either:
    name | location-anchor + address | surface | in/outdoor | phone | # | access
… or the spillover note row (`<td colspan="6">…Note: …</td>`) which we
attach to the previous court as `notes`.

Court row example
-----------------
    <tr><td rowspan="2">Astoria Park</td>
        <td><a href='/parks/astoria-park'>Astoria Park</a><br/>21st St. & Hoyt Ave.</td>
        <td>Hard</td><td>Outdoor<td>(718) 626-8136</td><td>14</td>
        <td></td></tr>

Output: /tmp/tennis/nyc_parks.json (list of court dicts).
"""
from __future__ import annotations

import html as html_mod
import json
import os
import re
import ssl
import sys
import urllib.request

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
URL = 'https://www.nycgovparks.org/facilities/tennis'
OUT_DIR = '/tmp/tennis'
OUT_PATH = os.path.join(OUT_DIR, 'nyc_parks.json')
HTML_PATH = os.path.join(OUT_DIR, 'nyc_parks.html')

BOROUGH_TABS = {
    'X': 'Bronx',
    'B': 'Brooklyn',
    'M': 'Manhattan',
    'Q': 'Queens',
    'R': 'Staten Island',
}

TAB_RE = re.compile(
    r'<div id="tab-(?P<key>[XBMQR])"[^>]*>(?P<body>.*?)</div>\s*<div class="cleardiv',
    re.DOTALL,
)
ROW_RE = re.compile(r'<tr>(?P<body>.*?)</tr>', re.DOTALL)
CELL_RE = re.compile(r'<td[^>]*>(?P<body>.*?)(?=<td|</tr>)', re.DOTALL)
PARK_LINK_RE = re.compile(r"href='(?P<href>/parks/[^']+)'>(?P<text>[^<]+)</a>", re.DOTALL)
TAGS_RE = re.compile(r'<[^>]+>')


def fetch() -> str:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(URL, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
        return resp.read().decode('utf-8', errors='replace')


def text(s: str) -> str:
    s = s.replace('<br/>', '\n').replace('<br>', '\n').replace('&nbsp;', ' ')
    s = TAGS_RE.sub('', s)
    return html_mod.unescape(s).strip()


def parse_location_cell(cell: str) -> tuple[str | None, str | None, str | None]:
    """Returns (park_name, park_url, address)."""
    park_url = None
    park_name = None
    m = PARK_LINK_RE.search(cell)
    if m:
        park_url = 'https://www.nycgovparks.org' + m.group('href')
        park_name = html_mod.unescape(m.group('text')).strip()
    rest = text(cell).split('\n')
    # First line is the linked park name; remainder is the address.
    if rest and park_name and rest[0].strip() == park_name:
        rest = rest[1:]
    address = ' '.join(p.strip() for p in rest if p.strip()) or None
    return park_name, park_url, address


def parse(html: str) -> list[dict]:
    courts: list[dict] = []
    for tm in TAB_RE.finditer(html):
        borough = BOROUGH_TABS.get(tm.group('key'))
        body = tm.group('body')
        rows = list(ROW_RE.finditer(body))
        last_court: dict | None = None
        carry_name: str | None = None
        for rm in rows:
            cells_html = re.findall(r'<td[^>]*>(.*?)(?=<td|</tr>|$)', rm.group('body'), re.DOTALL)
            if not cells_html:
                continue
            # Skip the header row (contains <th>).
            if '<th' in rm.group('body'):
                continue
            # Spillover note row is a single colspan cell.
            if len(cells_html) == 1:
                if last_court is not None:
                    note_text = text(cells_html[0])
                    note_text = re.sub(r'^\s*Note:\s*', '', note_text, flags=re.I).strip()
                    if note_text:
                        last_court['notes'] = note_text
                continue
            # Detect the rowspan'd name column: when present, len(cells)==7 and
            # the first cell holds the facility name. Otherwise the name was
            # carried over from the previous row's rowspan.
            if len(cells_html) >= 7:
                name = text(cells_html[0])
                loc, surface, indoor, phone, ncourts, access = cells_html[1:7]
                # If this row is the *first* of a rowspan group, remember the
                # name for any sibling rows that follow without a name cell.
                if 'rowspan' in rm.group('body').split('<td', 2)[1]:
                    carry_name = name
                else:
                    carry_name = None
            else:
                # Row inherits the previously remembered rowspan name.
                if carry_name is None:
                    continue
                name = carry_name
                loc, surface, indoor, phone, ncourts, access = cells_html[:6]

            park_name, park_url, address = parse_location_cell(loc)
            ncourts_text = text(ncourts)
            try:
                ncourts_int = int(re.search(r'\d+', ncourts_text).group(0))
            except (AttributeError, ValueError):
                ncourts_int = None
            indoor_text = text(indoor)
            court = {
                'borough': borough,
                'name': name,
                'park_name': park_name,
                'park_url': park_url,
                'address': address,
                'surface': text(surface) or None,
                'indoor_outdoor': indoor_text or None,
                'is_indoor': indoor_text.lower() == 'indoor' if indoor_text else None,
                'phone': text(phone) or None,
                'courts': ncourts_int,
                'accessible': bool(re.search(r'Accessibility Symbol', access)),
            }
            courts.append(court)
            last_court = court
    return courts


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f'fetching {URL} ...', file=sys.stderr)
    html = fetch()
    with open(HTML_PATH, 'w') as f:
        f.write(html)
    courts = parse(html)
    print(f'parsed {len(courts)} NYC Parks tennis facilities', file=sys.stderr)
    from collections import Counter
    cb = Counter(c['borough'] for c in courts)
    for b, n in cb.most_common():
        print(f'  {b:.<20} {n}', file=sys.stderr)
    courts.sort(key=lambda c: (c['borough'] or '', c['name'].lower()))
    with open(OUT_PATH, 'w') as f:
        json.dump(courts, f, indent=2)
    print(f'wrote {OUT_PATH}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
