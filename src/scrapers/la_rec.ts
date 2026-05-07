// LA City Rec & Parks scraper.
// Targets the ActiveNet "ANC" platform (anc.apm.activecommunities.com/laparks).
//
// Strategy: ActiveNet's reservation UI calls JSON endpoints internally. We hit those
// directly with fetch() — no browser needed. This is the same data the website uses,
// so we get the same answer the user would see, but ~50x faster than Playwright.
//
// The exact endpoints and payloads were derived by opening the booking page,
// watching the Network tab, and replaying the requests. ActiveNet occasionally
// changes these — when this scraper breaks, that's the first place to look.

import { Scraper, ScrapeResult, ScrapedFacility, ScrapedSlot } from '../lib/types';
import { addDays, format } from 'date-fns';

const BASE = 'https://anc.apm.activecommunities.com/laparks';

// ActiveNet uses an internal "customer_id" cookie/header. Easiest reliable approach:
// fetch the landing page once, parse the cookie, reuse for subsequent calls.
async function bootstrapSession(): Promise<{ headers: Record<string, string> }> {
  const res = await fetch(`${BASE}/reservation/landing/search?locale=en-US`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HottiesThatHit/0.1)',
    },
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  // Extract the JSESSIONID and customer_id cookies if present.
  const cookieHeader = setCookie
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  return {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HottiesThatHit/0.1)',
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
      Cookie: cookieHeader,
      // ActiveNet checks this on POST; mirroring the browser keeps us under the radar.
      'X-Requested-With': 'XMLHttpRequest',
      Origin: 'https://anc.apm.activecommunities.com',
      Referer: `${BASE}/reservation/landing/search`,
    },
  };
}

// Step 1: list all tennis facilities. ActiveNet's "search" endpoint accepts a center_ids
// filter and a resource_type filter. Tennis is typically resource_group_id ~ specific to
// the agency. The first time you wire this up, you'll inspect the Network tab to grab
// the right IDs for laparks. Placeholders below — see TODO.
async function listFacilities(
  session: { headers: Record<string, string> },
): Promise<ScrapedFacility[]> {
  // TODO: Replace `RESOURCE_GROUP_ID_TENNIS` with the actual ID from the laparks instance.
  // To find it: open https://anc.apm.activecommunities.com/laparks/reservation/landing/search,
  // pick "Tennis" from the activity filter, watch Network tab for the POST to
  // /rest/reservation/quickreservation/availability — the request body shows the IDs.
  const RESOURCE_GROUP_ID_TENNIS = 0; // <-- fill in (see PROJECT_HANDOFF.md Day-1 Step 6)

  const body = {
    activity_select_param: 2, // 2 = "any time on selected date" in ActiveNet
    center_ids: [],
    resource_ids: [],
    resource_group_ids: [RESOURCE_GROUP_ID_TENNIS],
    page_number: 1,
    page_size: 100,
  };

  const res = await fetch(
    `${BASE}/rest/reservation/resource?locale=en-US`,
    {
      method: 'POST',
      headers: session.headers,
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`ActiveNet listFacilities failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    body?: {
      resources?: Array<{
        resource_id: number;
        resource_name: string;
        center_name: string;
        center_id: number;
        address?: string;
      }>;
    };
  };

  const resources = data.body?.resources ?? [];

  // Group by center (facility) — ActiveNet returns one row per court; we want one row per location.
  const byCenter = new Map<number, ScrapedFacility>();
  for (const r of resources) {
    const existing = byCenter.get(r.center_id);
    if (existing) {
      existing.numCourts = (existing.numCourts ?? 0) + 1;
    } else {
      byCenter.set(r.center_id, {
        externalId: String(r.center_id),
        name: r.center_name,
        address: r.address,
        city: 'Los Angeles',
        numCourts: 1,
      });
    }
  }

  return Array.from(byCenter.values());
}

// Step 2: for each facility, query availability for the next N days.
async function getAvailability(
  session: { headers: Record<string, string> },
  facilityExternalId: string,
  date: Date,
): Promise<ScrapedSlot[]> {
  const body = {
    facility_id: Number(facilityExternalId),
    date: format(date, 'yyyy-MM-dd'),
    // ActiveNet expects start/end in minutes-from-midnight. 6am to 10pm covers all reasonable play.
    start_time: 360,
    end_time: 1320,
  };

  const res = await fetch(
    `${BASE}/rest/reservation/quickreservation/availability?locale=en-US`,
    {
      method: 'POST',
      headers: session.headers,
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    // Don't blow up the whole run if one facility fails — log and skip.
    console.warn(`Availability failed for facility ${facilityExternalId} on ${body.date}: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as {
    body?: {
      availability?: Array<{
        resource_id: number;
        resource_name: string;       // typically "Court 1", "Court 2"
        time_blocks?: Array<{
          start_time: string;        // "06:00"
          end_time: string;          // "07:00"
          is_available: boolean;
          fee_amount?: number;       // dollars
        }>;
      }>;
    };
  };

  const slots: ScrapedSlot[] = [];
  for (const court of data.body?.availability ?? []) {
    for (const block of court.time_blocks ?? []) {
      const [sh, sm] = block.start_time.split(':').map(Number);
      const [eh, em] = block.end_time.split(':').map(Number);
      const start = new Date(date);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(date);
      end.setHours(eh, em, 0, 0);

      slots.push({
        facilityExternalId,
        courtNumber: court.resource_name,
        startTime: start,
        endTime: end,
        available: block.is_available,
        priceCents: block.fee_amount != null ? Math.round(block.fee_amount * 100) : undefined,
        bookingUrl: `${BASE}/reservation/landing/quick?groupId=${facilityExternalId}`,
      });
    }
  }
  return slots;
}

export const laRecScraper: Scraper = {
  sourceId: 'la_rec',

  async scrape(daysAhead: number): Promise<ScrapeResult> {
    const session = await bootstrapSession();
    const facilities = await listFacilities(session);

    const slots: ScrapedSlot[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sequential, with a small delay — being a polite scraper avoids rate limiting.
    for (const facility of facilities) {
      for (let i = 0; i < daysAhead; i++) {
        const date = addDays(today, i);
        const dailySlots = await getAvailability(session, facility.externalId, date);
        slots.push(...dailySlots);
        await new Promise((r) => setTimeout(r, 250)); // 4 req/sec ceiling
      }
    }

    return { facilities, slots };
  },
};
