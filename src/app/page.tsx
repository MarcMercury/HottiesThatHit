// Mobile-first home page. Lists available slots grouped by facility.
// Server component — fetches from our API route.

import { format, addDays } from 'date-fns';

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
  };
}

async function fetchSlots(date: string): Promise<Slot[]> {
  // Use absolute URL on the server. NEXT_PUBLIC_SITE_URL = http://localhost:3000 locally.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/slots?date=${date}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return json.slots ?? [];
}

export default async function Home({ searchParams }: { searchParams: { date?: string } }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const date = searchParams.date ?? today;
  const slots = await fetchSlots(date);

  // Group by facility for a cleaner mobile view.
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

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 bg-white border-b border-zinc-200 px-4 py-3">
        <h1 className="text-lg font-semibold">Hotties That Hit</h1>
        <p className="text-xs text-zinc-500">Every open court in LA. One screen.</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {dateOptions.map((d) => (
            <a
              key={d.value}
              href={`/?date=${d.value}`}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                d.value === date ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {d.label}
            </a>
          ))}
        </div>
      </header>

      <section className="px-4 py-3">
        {byFacility.size === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">
            No availability found for {format(new Date(date), 'EEEE, MMM d')}.
            <br />
            (Or scrapers haven&apos;t run yet — try <code>npm run scrape:la-rec</code>.)
          </p>
        ) : (
          Array.from(byFacility.values()).map(({ facility, slots }) => (
            <div key={facility.id} className="mb-4 bg-white rounded-lg border border-zinc-200 p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="font-semibold">{facility.name}</h2>
                  <p className="text-xs text-zinc-500">
                    {facility.city ?? ''}{facility.surface ? ` · ${facility.surface}` : ''}{facility.lights ? ' · lights' : ''}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded">{facility.source_id}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slots.slice(0, 30).map((s) => (
                  <a
                    key={s.id}
                    href={s.booking_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-100"
                  >
                    {format(new Date(s.start_time), 'h:mma').toLowerCase()}
                    {s.court_number ? ` · ${s.court_number}` : ''}
                  </a>
                ))}
                {slots.length > 30 && (
                  <span className="text-xs text-zinc-500 px-2 py-1">+{slots.length - 30} more</span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
