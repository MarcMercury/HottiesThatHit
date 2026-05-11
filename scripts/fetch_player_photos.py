#!/usr/bin/env python3
"""
Fetch headshot images for ATP/WTA players from Wikipedia/Wikimedia Commons
and save them to public/players/<slug>.jpg.

Uses the MediaWiki action API (pageimages) which is permissive and batchable.

Usage:
    python3 scripts/fetch_player_photos.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PLAYERS = [
    # ATP
    "Jannik Sinner",
    "Carlos Alcaraz",
    "Novak Djokovic",
    "Alexander Zverev",
    "Daniil Medvedev",
    "Taylor Fritz",
    "Frances Tiafoe",
    "Tommy Paul",
    "Ben Shelton",
    "Casper Ruud",
    "Holger Rune",
    "Stefanos Tsitsipas",
    "Andrey Rublev",
    "Hubert Hurkacz",
    "Grigor Dimitrov",
    # WTA
    "Aryna Sabalenka",
    "Iga Swiatek",
    "Coco Gauff",
    "Elena Rybakina",
    "Jessica Pegula",
    "Naomi Osaka",
    "Mirra Andreeva",
    "Qinwen Zheng",
    "Jasmine Paolini",
    "Madison Keys",
    "Emma Navarro",
    "Daria Kasatkina",
    "Barbora Krejcikova",
    "Karolina Muchova",
    "Ons Jabeur",
]

OUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "public", "players")
)
USER_AGENT = (
    "HottiesThatHitBot/0.1 "
    "(https://github.com/MarcMercury/HottiesThatHit; admin@hottiesthat.hit) "
    "python-urllib"
)


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def http_get(url: str, retries: int = 5) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 503):
                wait = 3 * (attempt + 1)
                print(f"   ({e.code}) backing off {wait}s...")
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(1 + attempt)
    assert last_err is not None
    raise last_err


def fetch_batch(titles: list[str]) -> dict[str, str]:
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "original|thumbnail",
        "pithumbsize": "600",
        "redirects": "1",
        "titles": "|".join(titles),
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    data = json.loads(http_get(url).decode("utf-8"))
    out: dict[str, str] = {}
    pages = data.get("query", {}).get("pages", {})
    normalized = {
        item["to"]: item["from"]
        for item in data.get("query", {}).get("normalized", []) or []
    }
    redirected = {
        item["to"]: item["from"]
        for item in data.get("query", {}).get("redirects", []) or []
    }

    def original_title(t: str) -> str:
        seen = set()
        cur = t
        while cur in redirected and cur not in seen:
            seen.add(cur)
            cur = redirected[cur]
        if cur in normalized:
            cur = normalized[cur]
        return cur

    for _, page in pages.items():
        title = page.get("title")
        if not title:
            continue
        img = None
        if isinstance(page.get("original"), dict):
            img = page["original"].get("source")
        if not img and isinstance(page.get("thumbnail"), dict):
            img = page["thumbnail"].get("source")
        if img:
            out[original_title(title)] = img
    return out


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    BATCH = 15
    image_map: dict[str, str] = {}
    for i in range(0, len(PLAYERS), BATCH):
        chunk = PLAYERS[i : i + BATCH]
        print(f"Querying batch {i // BATCH + 1}: {len(chunk)} titles")
        try:
            image_map.update(fetch_batch(chunk))
        except Exception as e:
            print(f"  batch failed: {e}")
        time.sleep(1.5)

    manifest: dict[str, str] = {}
    for name in PLAYERS:
        slug = slugify(name)
        out_path = os.path.join(OUT_DIR, f"{slug}.jpg")
        print(f"-> {name}")
        if os.path.exists(out_path) and os.path.getsize(out_path) > 2048:
            print(f"   already have {out_path}")
            manifest[name] = f"/players/{slug}.jpg"
            continue
        img_url = image_map.get(name)
        if not img_url:
            print(f"   no image found")
            continue
        try:
            data = http_get(img_url)
        except Exception as e:
            print(f"   download failed: {e}")
            continue
        with open(out_path, "wb") as f:
            f.write(data)
        manifest[name] = f"/players/{slug}.jpg"
        print(f"   saved {out_path} ({len(data)} bytes)")
        time.sleep(0.5)

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nWrote manifest: {manifest_path}")
    print(f"Got {len(manifest)}/{len(PLAYERS)} images.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
