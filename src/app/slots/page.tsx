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

  const start = new Date(`${date}T00:00:00`).toISOString();
  const end = new Date(`${date}T23:59:59`).toISOString();
  const slotQ = supabase
    .from('slots')
    .select(
      'id, facility_id, court_number, start_time, end_time, price_cents, booking_url'
    )
    .eq('available', true)
    .gte('start_time', start)
    .lte('start_time', end)
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
  const today = format(new Date(), 'yyyy-MM-dd');
  const date = searchParams.date ?? today;
  const region =
    searchParams.region && searchParams.region !== 'all'
      ? searchParams.region
      : null;

  const { regions, facilities, totalSlots } = await loadData(date, region);

  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(new Date(), i);
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE M/d') };
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

  return (
    <main>
      <PageHeader
        eyebrow="Live availability"
        title="Open Slots"
        subtitle="Pick a date and an LA area — see every court there, with bookable times when we have them."
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
            <div className="grid gap-4 md:grid-cols-2">
              {facilities.map((f) => {
                const wx = weatherByFacility.get(f.id);
                const dirHref = directionsUrl({
                  destLat: f.lat ?? undefined,
                  destLng: f.lng ?? undefined,
                  destAddress:
                    f.address ?? `${f.name}, ${f.city ?? 'Los Angeles'}`,
                });
                const slots = f.slots;
                return (
                  <div key={f.id} className="card p-4">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-white truncate">
                          {f.name}
                        </h2>
                        <p className="text-xs text-white/50">
                          {f.region ?? f.city ?? ''}
                          {f.surface ? ` · ${f.surface}` : ''}
                          {f.lights ? ' · lights' : ''}
                          {f.num_courts ? ` · ${f.num_courts} courts` : ''}
                        </p>
                        {wx && (
                          <p className="text-xs text-white/60 mt-1">
                            <span aria-hidden>{wx.emoji}</span> {wx.label} ·{' '}
                            {wx.lowF}°/{wx.highF}°
                            {wx.precipPct > 20
                              ? ` · ${wx.precipPct}% rain`
                              : ''}
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

                    {slots.length > 0 ? (
                      <>
                        <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">
                          Open times — tap to book
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {slots.slice(0, 30).map((s) => (
                            <a
                              key={s.id}
                              href={s.booking_url ?? f.booking_url ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs px-2.5 py-1 rounded-md bg-hot-500/15 text-hot-100
                                         border border-hot-500/30 hover:bg-hot-500/30 hover:text-white transition"
                            >
                              {format(new Date(s.start_time), 'h:mma').toLowerCase()}
                              {s.court_number ? ` · ${s.court_number}` : ''}
                            </a>
                          ))}
                          {slots.length > 30 && (
                            <span className="text-xs text-white/40 px-2 py-1">
                              +{slots.length - 30} more
                            </span>
                          )}
                        </div>
                      </>
                    ) : f.booking_url ? (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-ink-line bg-ink-soft/40 p-3">
                        <p className="text-xs text-white/60">
                          {f.online_booking
                            ? 'Live availability not yet scraped — check the reservation site directly.'
                            : f.category === 'Public Open'
                              ? 'Free drop-in park · no online reservation system.'
                              : 'No online booking — call ahead or visit the operator site.'}
                        </p>
                        <a
                          href={f.booking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs whitespace-nowrap px-3 py-1.5 rounded-md bg-hot-500/20 text-hot-100 border border-hot-500/30 hover:bg-hot-500/40 hover:text-white transition"
                        >
                          Reserve ↗
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-md border border-ink-line bg-ink-soft/40 p-3 text-xs text-white/50">
                        Free drop-in park · first come, first served.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
