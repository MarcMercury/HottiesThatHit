// Open Slots — pick a date + LA area, see every court in that area with
// any scraped availability and a one-tap link to its reservation page.

import { format, addDays } from 'date-fns';
import { PageHeader } from '@/components/PageHeader';
import { getDailyForecast, describeWeather } from '@/lib/weather';
import { directionsUrl } from '@/lib/maps';
import { getServiceClient } from '@/lib/supabase';

interface FacilityRow {
  id: string;
  source_id: string;
  external_id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  num_courts: number | null;
  surface: string | null;
  lights: boolean | null;
  category: string | null;
  region: string | null;
  online_booking: boolean | null;
  facility_booking_url: string | null;
}

interface SlotRow {
  id: string;
  facility_id: string;
  court_number: string | null;
  start_time: string;
  end_time: string;
  price_cents: number | null;
  booking_url: string | null;
}

interface FacilityView extends FacilityRow {
  source_name: string;
  booking_url: string | null;
  slots: SlotRow[];
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Open Slots · Hotties That Hit' };

const LA_TZ = 'America/Los_Angeles';

// Convert an LA-local YYYY-MM-DD date into the half-open UTC instant range
// [startUtc, endUtc) covering that LA calendar day. Handles DST correctly.
function laDayBoundsUtc(date: string): { startUtc: string; endUtc: string } {
  const startUtc = laMidnightUtc(date);
  // Add 24h then re-normalize for DST transition days.
  const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const endUtc = laMidnightUtc(nextStr);
  return { startUtc, endUtc };
}

function laMidnightUtc(date: string): string {
  // LA UTC offset for the given date. PDT = -07:00, PST = -08:00.
  const probe = new Date(`${date}T12:00:00Z`);
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    timeZoneName: 'shortOffset',
    hour12: false,
    hour: 'numeric',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-8';
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tzName);
  const sign = m?.[1] === '+' ? 1 : -1;
  const h = m ? parseInt(m[2], 10) : 8;
  const min = m?.[3] ? parseInt(m[3], 10) : 0;
  const offsetMinutes = sign * (h * 60 + min); // e.g. -420 for PDT
  // LA midnight is `date 00:00:00 + offset` worth of minutes past UTC midnight.
  // utc = local - offset, so utc midnight = -offsetMinutes added to date 00:00Z.
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCMinutes(base.getUTCMinutes() - offsetMinutes);
  return base.toISOString();
}

function formatLaTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s/g, '')
    .toLowerCase();
}

function todayInLa(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// The slot-level booking_url scraped from LA WebTrac is the AJAX
// `UpdateSelection` endpoint that returns JSON like
// `{"status":"added","descriptions":"<span...>"}` — useless to a human user.
// Instead, point tap-to-book at the facility's interactive search page and
// prefill the chosen date so the user lands on the right calendar view.
function buildBookingHref(facilityUrl: string | null, date: string): string | null {
  if (!facilityUrl) return null;
  // Only rewrite WebTrac (LA Rec) search URLs; leave third-party links alone.
  if (!/webtrac\.wsc\/search\.html/i.test(facilityUrl)) return facilityUrl;
  try {
    const url = new URL(facilityUrl);
    const [y, m, d] = date.split('-');
    if (y && m && d) {
      const formatted = `${m}/${d}/${y}`;
      url.searchParams.set('begindate', formatted);
      url.searchParams.set('enddate', formatted);
      url.searchParams.set('display', 'Detail');
    }
    return url.toString();
  } catch {
    return facilityUrl;
  }
}

async function loadData(date: string, region: string | null) {
  const supabase = getServiceClient();

  // Pull all active, geocoded facilities so we can both filter by region and
  // know booking URLs even when a facility has no scraped slots.
  const facQ = supabase
    .from('facilities')
    .select(
      'id, source_id, external_id, name, address, city, lat, lng, num_courts, surface, lights, category, region, online_booking, facility_booking_url'
    )
    .eq('active', true)
    .order('name');

  const srcQ = supabase.from('sources').select('id, name, booking_url');
  // Interpret `date` as an LA-local calendar day, not a UTC day. The scraper
  // stores wall-clock LA times converted to real UTC instants, so an LA 9pm
  // slot on May 9 lives at ~2026-05-10T04:00Z. Filtering by UTC midnight would
  // miss every evening slot and break the day picker.
  const { startUtc, endUtc } = laDayBoundsUtc(date);
  const slotQ = supabase
    .from('slots')
    .select(
      'id, facility_id, court_number, start_time, end_time, price_cents, booking_url'
    )
    .eq('available', true)
    .gte('start_time', startUtc)
    .lt('start_time', endUtc)
    .order('start_time', { ascending: true })
    .limit(2000);

  const [facRes, srcRes, slotRes] = await Promise.all([facQ, srcQ, slotQ]);

  const sources = new Map(
    (srcRes.data ?? []).map((s) => [s.id, s] as const)
  );
  const allFacilities: FacilityRow[] = facRes.data ?? [];
  const slots: SlotRow[] = slotRes.data ?? [];

  const regions = Array.from(
    new Set(allFacilities.map((f) => f.region).filter(Boolean) as string[])
  ).sort();

  const inRegion = region
    ? allFacilities.filter((f) => f.region === region)
    : allFacilities;

  const slotsByFacility = new Map<string, SlotRow[]>();
  for (const s of slots) {
    const arr = slotsByFacility.get(s.facility_id) ?? [];
    arr.push(s);
    slotsByFacility.set(s.facility_id, arr);
  }

  const view: FacilityView[] = inRegion.map((f) => {
    const src = sources.get(f.source_id);
    return {
      ...f,
      source_name: src?.name ?? f.source_id,
      booking_url: f.facility_booking_url ?? src?.booking_url ?? null,
      slots: slotsByFacility.get(f.id) ?? [],
    };
  });

  // Sort: facilities with scraped slots first, then online-bookable, then rest.
  view.sort((a, b) => {
    const sA = a.slots.length > 0 ? 0 : a.online_booking ? 1 : 2;
    const sB = b.slots.length > 0 ? 0 : b.online_booking ? 1 : 2;
    if (sA !== sB) return sA - sB;
    return a.name.localeCompare(b.name);
  });

  return { regions, facilities: view, totalSlots: slots.length };
}

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: { date?: string; region?: string };
}) {
  const today = todayInLa();
  const date = searchParams.date ?? today;
  const region =
    searchParams.region && searchParams.region !== 'all'
      ? searchParams.region
      : null;

  const { regions, facilities, totalSlots } = await loadData(date, region);

  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const value = addDaysIso(today, i);
    // Build a noon-LA Date so the label formats reliably regardless of host TZ.
    const labelDate = new Date(`${value}T12:00:00-08:00`);
    return {
      value,
      label: new Intl.DateTimeFormat('en-US', {
        timeZone: LA_TZ,
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
      }).format(labelDate),
    };
  });

  // Per-facility weather (downtown-LA fallback if no lat/lng).
  const LA_CENTROID = { lat: 34.0522, lng: -118.2437 };
  const weatherByFacility = new Map<
    string,
    {
      highF: number;
      lowF: number;
      precipPct: number;
      emoji: string;
      label: string;
    } | null
  >();
  await Promise.all(
    facilities.map(async (f) => {
      const lat = f.lat ?? LA_CENTROID.lat;
      const lng = f.lng ?? LA_CENTROID.lng;
      const fc = await getDailyForecast(lat, lng, date);
      if (!fc) {
        weatherByFacility.set(f.id, null);
        return;
      }
      const { emoji, label } = describeWeather(fc.weatherCode);
      weatherByFacility.set(f.id, {
        highF: fc.highF,
        lowF: fc.lowF,
        precipPct: fc.precipPct,
        emoji,
        label,
      });
    })
  );

  const withSlots = facilities.filter((f) => f.slots.length > 0).length;

  // Bucket facilities so the page leads with what you can actually act on
  // *now*, instead of burying live availability under 100 drop-in parks.
  const liveFacilities = facilities.filter((f) => f.slots.length > 0);
  const onlineFacilities = facilities.filter(
    (f) => f.slots.length === 0 && f.online_booking && !!f.booking_url,
  );
  const otherFacilities = facilities.filter(
    (f) => f.slots.length === 0 && !(f.online_booking && f.booking_url),
  );

  return (
    <main>
      <PageHeader
        eyebrow="Live availability"
        title="Open Slots"
        subtitle="Live-scraped tee times from LA Rec & Parks, plus every other public court in the region with the operator's reservation link."
      />

      <section className="mx-auto max-w-6xl px-4 py-6">
        {/* Filters */}
        <form
          method="GET"
          className="card p-4 flex flex-col gap-4 md:flex-row md:items-end md:gap-6"
        >
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Date
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {dateOptions.map((d) => {
                const href = `/slots?date=${d.value}${
                  region ? `&region=${encodeURIComponent(region)}` : ''
                }`;
                return (
                  <a
                    key={d.value}
                    href={href}
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition ${
                      d.value === date
                        ? 'bg-hot-500 border-hot-500 text-white shadow-glow-sm'
                        : 'border-ink-line bg-ink-soft/60 text-white/70 hover:text-white hover:border-hot-500/50'
                    }`}
                  >
                    {d.label}
                  </a>
                );
              })}
            </div>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="mt-2 bg-ink-soft/60 border border-ink-line rounded-md px-3 py-1.5 text-sm text-white/80"
            />
          </div>

          <div className="md:w-72">
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Area of LA
            </label>
            <select
              name="region"
              defaultValue={region ?? 'all'}
              className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white"
            >
              <option value="all">All of greater LA</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-md bg-hot-500 hover:bg-hot-400 text-white text-sm font-medium shadow-glow-sm"
          >
            Update
          </button>
        </form>

        <p className="mt-3 text-xs text-white/50">
          {facilities.length} {facilities.length === 1 ? 'court' : 'courts'}
          {region ? ` in ${region}` : ' in greater LA'} · {withSlots} with live
          availability · {totalSlots} open time slots for{' '}
          {format(new Date(date), 'EEE MMM d')}
        </p>

        <div className="mt-6">
          {facilities.length === 0 ? (
            <div className="card p-8 text-center text-white/60">
              <p>No courts found{region ? ` in ${region}` : ''}.</p>
              <p className="text-xs mt-2 text-white/40">
                Try a different area, or check the{' '}
                <a className="text-hot-300 underline" href="/courts">
                  full court directory
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* ---------- 1. Live availability ---------- */}
              <section>
                <header className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="font-display text-2xl text-white">
                    Live availability
                  </h2>
                  <span className="text-xs text-white/50">
                    {liveFacilities.length}{' '}
                    {liveFacilities.length === 1 ? 'facility' : 'facilities'} ·{' '}
                    {totalSlots} open slots
                  </span>
                </header>
                {liveFacilities.length === 0 ? (
                  <div className="card p-6 text-sm text-white/60">
                    No live-scraped availability for{' '}
                    {format(new Date(date), 'EEE MMM d')}
                    {region ? ` in ${region}` : ''}. Try another date, or use the
                    facilities below.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {liveFacilities.map((f) => (
                      <FacilityCard
                        key={f.id}
                        f={f}
                        date={date}
                        wx={weatherByFacility.get(f.id) ?? null}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ---------- 2. Online booking, no live data ---------- */}
              {onlineFacilities.length > 0 && (
                <section>
                  <header className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 className="font-display text-2xl text-white">
                      Online booking
                    </h2>
                    <span className="text-xs text-white/50">
                      {onlineFacilities.length} more{' '}
                      {onlineFacilities.length === 1 ? 'facility' : 'facilities'}{' '}
                      with their own reservation site
                    </span>
                  </header>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {onlineFacilities.map((f) => (
                      <CompactFacilityCard key={f.id} f={f} date={date} />
                    ))}
                  </div>
                </section>
              )}

              {/* ---------- 3. Drop-in / phone-only ---------- */}
              {otherFacilities.length > 0 && (
                <section>
                  <details className="card p-4">
                    <summary className="cursor-pointer text-sm text-white/80 hover:text-white">
                      <span className="font-semibold">
                        {otherFacilities.length} drop-in / phone-only courts
                      </span>
                      <span className="text-white/50">
                        {' '}
                        — public parks &amp; facilities without an online time grid
                      </span>
                    </summary>
                    <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                      {otherFacilities.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between gap-2 py-1 border-b border-ink-line/60"
                        >
                          <span className="min-w-0 truncate">
                            <span className="text-white/90">{f.name}</span>
                            <span className="text-white/40 text-xs">
                              {' · '}
                              {f.region ?? f.city ?? 'LA'}
                            </span>
                          </span>
                          <a
                            href={directionsUrl({
                              destLat: f.lat ?? undefined,
                              destLng: f.lng ?? undefined,
                              destAddress:
                                f.address ?? `${f.name}, ${f.city ?? 'Los Angeles'}`,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-hot-300 hover:text-hot-200 shrink-0"
                          >
                            Directions ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </section>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ---------- Cards ----------

function FacilityCard({
  f,
  date,
  wx,
}: {
  f: FacilityView;
  date: string;
  wx:
    | {
        highF: number;
        lowF: number;
        precipPct: number;
        emoji: string;
        label: string;
      }
    | null;
}) {
  const dirHref = directionsUrl({
    destLat: f.lat ?? undefined,
    destLng: f.lng ?? undefined,
    destAddress: f.address ?? `${f.name}, ${f.city ?? 'Los Angeles'}`,
  });
  const slotBookHref = buildBookingHref(f.booking_url, date);
  const slots = f.slots;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{f.name}</h3>
          <p className="text-xs text-white/50">
            {f.region ?? f.city ?? ''}
            {f.surface ? ` · ${f.surface}` : ''}
            {f.lights ? ' · lights' : ''}
            {f.num_courts ? ` · ${f.num_courts} courts` : ''}
          </p>
          {wx && (
            <p className="text-xs text-white/60 mt-1">
              <span aria-hidden>{wx.emoji}</span> {wx.label} · {wx.lowF}°/
              {wx.highF}°
              {wx.precipPct > 20 ? ` · ${wx.precipPct}% rain` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="chip">{f.source_name}</span>
          <a
            href={dirHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2 py-0.5 rounded-md border border-ink-line text-white/70 hover:text-white hover:border-hot-500/50"
          >
            Directions ↗
          </a>
        </div>
      </div>

      <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">
        Open times — tap to book
      </p>
      <div className="flex flex-wrap gap-1.5">
        {slots.slice(0, 30).map((s) => (
          <a
            key={s.id}
            href={slotBookHref ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2.5 py-1 rounded-md bg-hot-500/15 text-hot-100 border border-hot-500/30 hover:bg-hot-500/30 hover:text-white transition"
          >
            {formatLaTime(s.start_time)}
            {s.court_number ? ` · ${s.court_number}` : ''}
          </a>
        ))}
        {slots.length > 30 && (
          <span className="text-xs text-white/40 px-2 py-1">
            +{slots.length - 30} more
          </span>
        )}
      </div>
    </div>
  );
}

function CompactFacilityCard({ f, date }: { f: FacilityView; date: string }) {
  const dirHref = directionsUrl({
    destLat: f.lat ?? undefined,
    destLng: f.lng ?? undefined,
    destAddress: f.address ?? `${f.name}, ${f.city ?? 'Los Angeles'}`,
  });
  const bookHref = buildBookingHref(f.booking_url, date) ?? f.booking_url;
  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{f.name}</p>
        <p className="text-xs text-white/50 truncate">
          {f.region ?? f.city ?? ''}
          {f.num_courts ? ` · ${f.num_courts} courts` : ''}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <a
          href={dirHref}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-white/60 hover:text-white"
        >
          Directions ↗
        </a>
        {bookHref ? (
          <a
            href={bookHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs whitespace-nowrap px-2.5 py-1 rounded-md bg-hot-500/20 text-hot-100 border border-hot-500/30 hover:bg-hot-500/40 hover:text-white transition"
          >
            Reserve ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
