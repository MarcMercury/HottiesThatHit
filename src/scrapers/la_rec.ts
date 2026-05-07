// LA City Department of Recreation and Parks — Pay Tennis scraper.
//
// Backend: Vermont Systems WebTrac, hosted at reg.recreation.parks.lacity.gov.
// LA migrated off ActiveNet (anc.apm.activecommunities.com/laparks) and now
// runs WebTrac for facility reservations. The booking UI is rendered server-side
// as classic ASP-style pages; we scrape the HTML directly.
//
// Auth required: search.html returns "no matching results" for unauthenticated
// requests, but full availability per court when logged in. LA_REC_USERNAME /
// LA_REC_PASSWORD env vars hold a real LA Parks household account.
//
// Login flow:
//   1) GET splash.html to receive a session cookie + form action with SessionID.
//   2) POST credentials to that action; usually 302s to a "Login Resume Session"
//      interstitial because WebTrac thinks any prior session may still be open.
//   3) POST loginresumesession_continue=yes with the embedded _csrf_token.
//
// Search:
//   GET search.html?Module=FR&category=<exact label>&begindate=MM/DD/YYYY
//       &enddate=MM/DD/YYYY&display=Detail
//   Each court is a <tr ... data-title="Facility Description"> row with metadata
//   followed by a <tr class="cart-blocks"> row containing one anchor per
//   bookable hour. Anchors with href="#" are unavailable; anchors with
//   FRFMIDList=<id>&action=UpdateSelection in href are bookable.

import { Scraper, ScrapeResult, ScrapedFacility, ScrapedSlot } from '../lib/types';
import { addDays, format } from 'date-fns';

const BASE = 'https://reg.recreation.parks.lacity.gov/web/wbwsc/webtrac.wsc';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Mapping from WebTrac "category" filter -> our facility metadata. External IDs
// match supabase/seed_la_rec.sql so existing rows are reused on upsert.
const FACILITIES: Array<{
  category: string;
  externalId: string;
  name: string;
  address: string;
  city: string;
  lights: boolean;
}> = [
  { category: 'Balboa Pay Tennis', externalId: 'la_rec:balboa', name: 'Balboa Tennis Courts', address: '17015 Burbank Blvd., Encino, CA 91316', city: 'Encino', lights: true },
  { category: 'Cheviot Hills Pay Tennis', externalId: 'la_rec:cheviot_hills', name: 'Cheviot Hills Tennis Courts', address: '2551 Motor Ave., Los Angeles, CA 90064', city: 'Los Angeles', lights: true },
  { category: 'Pacific Palisades Pay Tennis', externalId: 'la_rec:pacific_palisades', name: 'Pacific Palisades Tennis Courts', address: '851 Alma Real Dr., Pacific Palisades, CA 90272', city: 'Pacific Palisades', lights: true },
  { category: 'Poinsettia Pay Tennis', externalId: 'la_rec:poinsettia', name: 'Poinsettia Tennis Courts', address: '7341 Willoughby Ave., Los Angeles, CA 90046', city: 'Los Angeles', lights: true },
  { category: 'Riverside Pay Tennis', externalId: 'la_rec:riverside', name: 'Riverside Tennis Courts (Griffith)', address: '3401 Riverside Drive, Los Angeles, CA 90027', city: 'Los Angeles', lights: true },
  { category: 'VNSO Pay Tennis', externalId: 'la_rec:van_nuys', name: 'Van Nuys / Sherman Oaks Tennis Courts', address: '14201 Huston Street, Van Nuys, CA 91423', city: 'Van Nuys', lights: true },
  { category: 'Vermont Canyon Pay Tennis', externalId: 'la_rec:vermont_canyon', name: 'Vermont Canyon Tennis Courts (Griffith)', address: '2715 Vermont Cyn., Los Angeles, CA 90027', city: 'Los Angeles', lights: false },
  { category: 'Westchester Pay Tennis', externalId: 'la_rec:westchester', name: 'Westchester Tennis Courts', address: '7000 W. Manchester Ave., Los Angeles, CA 90045', city: 'Los Angeles', lights: true },
  { category: 'Westwood Pay Tennis', externalId: 'la_rec:westwood', name: 'Westwood Tennis Courts', address: '1350 Sepulveda Blvd., Los Angeles, CA 90024', city: 'Los Angeles', lights: true },
];

// ---- minimal cookie jar -------------------------------------------------

class CookieJar {
  private cookies = new Map<string, string>();

  ingest(setCookieHeader: string | null) {
    if (!setCookieHeader) return;
    for (const raw of splitSetCookie(setCookieHeader)) {
      const [pair] = raw.split(';');
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

// node fetch concatenates multiple Set-Cookie headers with ", ", but the
// "expires=Xxx, DD-Mon-YYYY ..." value also contains commas. A real cookie
// boundary is a comma followed by a `name=` token before the next ';'.
function splitSetCookie(header: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const next of header.split(',')) {
    if (buf && !/^\s*[a-zA-Z0-9_-]+\s*=/.test(next)) {
      buf += ',' + next;
    } else {
      if (buf) out.push(buf);
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// ---- HTTP helpers (manual redirect handling so cookies persist) ---------

async function get(url: string, jar: CookieJar, hops = 0): Promise<string> {
  if (hops > 8) throw new Error(`Too many redirects: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*', Cookie: jar.header() },
    redirect: 'manual',
  });
  jar.ingest(res.headers.get('set-cookie'));
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (loc) return get(loc.startsWith('http') ? loc : new URL(loc, url).toString(), jar, hops + 1);
  }
  return res.text();
}

async function postForm(url: string, body: Record<string, string>, jar: CookieJar): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.header(),
    },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual',
  });
  jar.ingest(res.headers.get('set-cookie'));
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (loc) return get(loc.startsWith('http') ? loc : new URL(loc, url).toString(), jar);
  }
  return res.text();
}

// ---- login --------------------------------------------------------------

async function login(jar: CookieJar): Promise<void> {
  const username = process.env.LA_REC_USERNAME;
  const password = process.env.LA_REC_PASSWORD;
  if (!username || !password) {
    throw new Error('LA_REC_USERNAME and LA_REC_PASSWORD env vars are required');
  }

  const splash = await get(`${BASE}/splash.html`, jar);
  const formAction = /id="login"[^>]*action="([^"]+)"/.exec(splash)?.[1];
  if (!formAction) throw new Error('LA WebTrac: login form not found on splash.html');
  const loginUrl = formAction.startsWith('http') ? formAction : `${BASE}/${formAction.replace(/^\//, '')}`;

  let body = await postForm(loginUrl, {
    Action: 'process',
    SubAction: '',
    weblogin_username: username,
    weblogin_password: password,
  }, jar);

  if (/Login Resume Session/i.test(body)) {
    const csrf = /_csrf_token=([A-Za-z0-9]+)/.exec(body)?.[1];
    if (!csrf) throw new Error('LA WebTrac: resume-session page missing _csrf_token');
    body = await postForm(`${BASE}/login.html`, {
      Action: 'process',
      SubAction: '',
      _csrf_token: csrf,
      loginresumesession_continue: 'yes',
    }, jar);
  }

  // Verify by fetching account.html — logged-in users see "Account Settings".
  const account = await get(`${BASE}/account.html`, jar);
  if (!/Account Settings/i.test(account)) {
    if (/Wrong Login or Password/i.test(body) || /Wrong Login or Password/i.test(account)) {
      throw new Error('LA WebTrac: invalid credentials');
    }
    throw new Error('LA WebTrac: login did not produce an authenticated session');
  }
}

// ---- search + parse -----------------------------------------------------

const FMID_RE = /\bFMID=(\d+)/;

interface ParsedCourt {
  courtName: string;
  locationLabel: string;
  priceCents: number;
  fmid?: string;
  slots: Array<{ start: string; end: string; available: boolean; href: string }>;
}

function parseSearchResults(html: string): ParsedCourt[] {
  // Each court occupies two <tr>s: a metadata row containing data-title="Facility Description"
  // and the immediately-following cart-blocks row with the time-slot anchors.
  const rows = html.split(/<tr\b/);
  const courts: ParsedCourt[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!/data-title="Facility Description"/.test(row)) continue;

    const courtName = /data-title="Facility Description"[^>]*>\s*([^<]+?)\s*</.exec(row)?.[1]?.trim();
    const locationLabel = /data-title="Location Description"[^>]*>\s*([^<]+?)\s*</.exec(row)?.[1]?.trim();
    const priceMatch = /data-title="Price"[^>]*>\s*\$?([\d.]+)\s*</.exec(row);
    const fmid = FMID_RE.exec(row)?.[1];
    if (!courtName || !locationLabel) continue;
    const priceCents = priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : 0;

    // The very next row segment is the cart-blocks <tr>.
    const cartRow = rows[i + 1] ?? '';
    const slots: ParsedCourt['slots'] = [];

    const cartRegex = /<a[^>]*class="[^"]*\bcart-button\b[^"]*\bcart-button--state-(\w+)\b[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = cartRegex.exec(cartRow)) !== null) {
      const state = m[1];
      if (state === 'label') continue; // the leading "Book Now:" pseudo-anchor
      const href = m[2];
      const labelText = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const tm = /^(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)$/i.exec(labelText);
      if (!tm) continue;
      slots.push({
        start: tm[1],
        end: tm[2],
        available: href !== '#' && /UpdateSelection/.test(href),
        href: href === '#' ? '' : href,
      });
    }

    courts.push({ courtName, locationLabel, priceCents, fmid, slots });
  }

  return courts;
}

// LA local time -> UTC Date. Process TZ should be America/Los_Angeles in prod,
// so setHours() interprets the components as LA local. If the runtime TZ is
// something else (UTC), we shift by the LA offset on `date`.
function laLocalDate(date: Date, hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])m$/i.exec(hhmm.trim());
  if (!m) throw new Error(`Cannot parse time: ${hhmm}`);
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const isPM = m[3].toLowerCase() === 'p';
  if (hour === 12) hour = isPM ? 12 : 0;
  else if (isPM) hour += 12;

  // Compose an LA wall-clock time and resolve to UTC via the IANA zone.
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const localStr = `${y}-${mo}-${d}T${hh}:${mm}:00`;

  // Determine LA UTC offset for this date by formatting in LA tz.
  const tzOffsetMin = laOffsetMinutes(new Date(`${localStr}Z`));
  // Convert the wall-clock to UTC: utc = local - offset (offset is positive west of UTC,
  // so for LA in PDT it's -420; for PST -480; we add `-offset` to local).
  const utc = new Date(`${localStr}Z`);
  utc.setUTCMinutes(utc.getUTCMinutes() - tzOffsetMin);
  return utc;
}

// Returns LA offset from UTC in minutes (e.g., -420 for PDT, -480 for PST).
function laOffsetMinutes(d: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
    hour12: false,
    hour: 'numeric',
  });
  const parts = fmt.formatToParts(d);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-8';
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tz);
  if (!m) return -480; // safe default = PST
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const mins = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h * 60 + mins);
}

async function searchFacility(
  jar: CookieJar,
  facility: typeof FACILITIES[number],
  date: Date,
): Promise<ParsedCourt[]> {
  const dateStr = format(date, 'MM/dd/yyyy');
  const params = new URLSearchParams({
    Module: 'FR',
    category: facility.category,
    begindate: dateStr,
    enddate: dateStr,
    display: 'Detail',
  });
  const html = await get(`${BASE}/search.html?${params}`, jar);
  return parseSearchResults(html);
}

// ---- entry --------------------------------------------------------------

export const laRecScraper: Scraper = {
  sourceId: 'la_rec',
  async scrape(daysAhead: number): Promise<ScrapeResult> {
    const jar = new CookieJar();
    await login(jar);

    const facilities: ScrapedFacility[] = FACILITIES.map((f) => ({
      externalId: f.externalId,
      name: f.name,
      address: f.address,
      city: f.city,
      lights: f.lights,
    }));

    const slots: ScrapedSlot[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // WebTrac opens reservations 8 days in advance — going further yields nothing.
    const horizon = Math.min(daysAhead, 8);

    // Build the full work queue, then process with bounded concurrency to stay
    // under the cron route's 60s ceiling. Per-search ~6s sequential; 6 in
    // parallel keeps the total under ~75s for 9 facilities × 8 days = 72 jobs.
    type Job = { f: typeof FACILITIES[number]; date: Date };
    const jobs: Job[] = [];
    for (const f of FACILITIES) {
      for (let d = 0; d < horizon; d++) {
        jobs.push({ f, date: addDays(today, d) });
      }
    }

    const CONCURRENCY = 12;
    let cursor = 0;
    async function worker() {
      while (cursor < jobs.length) {
        const idx = cursor++;
        const { f, date } = jobs[idx];
        try {
          const courts = await searchFacility(jar, f, date);
          for (const c of courts) {
            for (const s of c.slots) {
              slots.push({
                facilityExternalId: f.externalId,
                courtNumber: c.courtName,
                startTime: laLocalDate(date, s.start),
                endTime: laLocalDate(date, s.end),
                available: s.available,
                priceCents: c.priceCents || undefined,
                bookingUrl: s.available ? s.href : undefined,
              });
            }
          }
        } catch (err) {
          // One facility/day failing shouldn't kill the whole run.
          console.warn(`[la_rec] search failed for ${f.category} ${format(date, 'yyyy-MM-dd')}:`, err);
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    return { facilities, slots };
  },
};
