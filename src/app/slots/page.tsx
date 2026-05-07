// Mobile-first slots page. Lists available slots grouped by facility.
// Server component — fetches from our API route.

import { format, addDays } from 'date-fns';
import { PageHeader } from '@/components/PageHeader';
import { getDailyForecast, describeWeather } from '@/lib/weather';
import { directionsUrl } from '@/lib/maps';

interface Slot {
  id: string;
  court_number: string | null;
  start_time: string;
  end_time: string;
  price_cents: number | null;
  booking_url: string | null;
  facility: {
    id: string;
    name: string;
    city: string | null;
    source_id: string;
    surface: string | null;
    lights: boolean;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
}

async function fetchSlots(date: string): Promise<Slot[]> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/slots?date=${date}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return json.slots ?? [];
}

export default async function SlotsPage({ searchParams }: { searchParams: { date?: string } }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const date = searchParams.date ?? today;
  const slots = await fetchSlots(date);

  const byFacility = new Map<string, { facility: Slot['facility']; slots: Slot[] }>();
  for (const s of slots) {
    const k = s.facility.id;
    if (!byFacility.has(k)) byFacility.set(k, { facility: s.facility, slots: [] });
    byFacility.get(k)!.slots.push(s);
  }

  const dateOptions = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(new Date(), i);
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE M/d') };
  });

  // Per-facility weather for the selected date. Each facility may have its own
  // lat/lng; fall back to a downtown-LA centroid if missing.
  const LA_CENTROID = { lat: 34.0522, lng: -118.2437 };
  const weatherByFacility = new Map<
    string,
    { highF: number; lowF: number; precipPct: number; emoji: string; label: string } | null
  >();
  await Promise.all(
    Array.from(byFacility.values()).map(async ({ facility }) => {
      const lat = facility.lat ?? LA_CENTROID.lat;
      const lng = facility.lng ?? LA_CENTROID.lng;
      const fc = await getDailyForecast(lat, lng, date);
      if (!fc) {
        weatherByFacility.set(facility.id, null);
        return;
      }
      const { emoji, label } = describeWeather(fc.weatherCode);
      weatherByFacility.set(facility.id, {
        highF: fc.highF,
        lowF: fc.lowF,
        precipPct: fc.precipPct,
        emoji,
        label,
      });
    })
  );

  return (
    <main>
      <PageHeader
        eyebrow="Live availability"
        title="Open Slots"
        subtitle="Every open court in LA, in one screen. Tap a time to book."
      />

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {dateOptions.map((d) => (
            <a
              key={d.value}
              href={`/slots?date=${d.value}`}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition ${
                d.value === date
                  ? 'bg-hot-500 border-hot-500 text-white shadow-glow-sm'
                  : 'border-ink-line bg-ink-soft/60 text-white/70 hover:text-white hover:border-hot-500/50'
              }`}
            >
              {d.label}
            </a>
          ))}
        </div>

        <div className="mt-6">
          {byFacility.size === 0 ? (
            <div className="card p-8 text-center text-white/60">
              <p>No availability found for {format(new Date(date), 'EEEE, MMM d')}.</p>
              <p className="text-xs mt-2 text-white/40">
                (Or scrapers haven&apos;t run yet — try <code className="text-hot-300">npm run scrape:la-rec</code>.)
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from(byFacility.values()).map(({ facility, slots }) => {
                const wx = weatherByFacility.get(facility.id);
                const dirHref = directionsUrl({
                  destLat: facility.lat ?? undefined,
                  destLng: facility.lng ?? undefined,
                  destAddress:
                    facility.address ?? `${facility.name}, ${facility.city ?? 'Los Angeles'}`,
                });
                return (
                  <div key={facility.id} className="card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="font-semibold text-white">{facility.name}</h2>
                        <p className="text-xs text-white/50">
                          {facility.city ?? ''}
                          {facility.surface ? ` · ${facility.surface}` : ''}
                          {facility.lights ? ' · lights' : ''}
                        </p>
                        {wx && (
                          <p className="text-xs text-white/60 mt-1">
                            <span aria-hidden>{wx.emoji}</span> {wx.label} · {wx.lowF}°/{wx.highF}°
                            {wx.precipPct > 20 ? ` · ${wx.precipPct}% rain` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="chip">{facility.source_id}</span>
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
                    <div className="flex flex-wrap gap-1.5">
                      {slots.slice(0, 30).map((s) => (
                        <a
                          key={s.id}
                          href={s.booking_url ?? '#'}
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
