// All public LA tennis courts, listed alphabetically with their reservation
// links. Live availability scraping was unreliable, so we just point users at
// the operator's booking page.

import { PageHeader } from '@/components/PageHeader';
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

interface FacilityView extends FacilityRow {
  source_name: string;
  booking_url: string | null;
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Courts & Reservations · Hotties That Hit' };

function extractZip(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

async function loadData(region: string | null, zip: string | null) {
  const supabase = getServiceClient();

  const facQ = supabase
    .from('facilities')
    .select(
      'id, source_id, external_id, name, address, city, lat, lng, num_courts, surface, lights, category, region, online_booking, facility_booking_url'
    )
    .eq('active', true)
    .order('name');

  const srcQ = supabase.from('sources').select('id, name, booking_url');

  const [facRes, srcRes] = await Promise.all([facQ, srcQ]);

  const sources = new Map(
    (srcRes.data ?? []).map((s) => [s.id, s] as const)
  );
  const allFacilities: FacilityRow[] = facRes.data ?? [];

  const regions = Array.from(
    new Set(allFacilities.map((f) => f.region).filter(Boolean) as string[])
  ).sort();

  const zips = Array.from(
    new Set(
      allFacilities
        .map((f) => extractZip(f.address))
        .filter((z): z is string => !!z)
    )
  ).sort();

  const zipTrim = zip?.trim() || null;

  const filtered = allFacilities.filter((f) => {
    if (region && f.region !== region) return false;
    if (zipTrim) {
      const fz = extractZip(f.address);
      if (!fz) return false;
      if (!fz.startsWith(zipTrim)) return false;
    }
    return true;
  });

  const view: FacilityView[] = filtered.map((f) => {
    const src = sources.get(f.source_id);
    return {
      ...f,
      source_name: src?.name ?? f.source_id,
      booking_url: f.facility_booking_url ?? src?.booking_url ?? null,
    };
  });

  view.sort((a, b) => a.name.localeCompare(b.name));

  return { regions, zips, facilities: view };
}

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: { region?: string; zip?: string };
}) {
  const region =
    searchParams.region && searchParams.region !== 'all'
      ? searchParams.region
      : null;
  const zip =
    searchParams.zip && searchParams.zip !== 'all' ? searchParams.zip : null;

  const { regions, zips, facilities } = await loadData(region, zip);

  const bookable = facilities.filter((f) => !!f.booking_url).length;

  return (
    <main>
      <PageHeader
        eyebrow="Courts & reservations"
        title="LA Public Tennis Courts"
        subtitle="Every public court in greater LA, alphabetical, with a one-tap link to the operator's reservation page."
      />

      <section className="mx-auto max-w-6xl px-4 py-6">
        <form
          method="GET"
          className="card p-4 flex flex-col gap-4 md:flex-row md:items-end md:gap-6"
        >
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

          <div className="md:w-56">
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              ZIP code
            </label>
            <select
              name="zip"
              defaultValue={zip ?? 'all'}
              className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white"
            >
              <option value="all">All ZIPs</option>
              {zips.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-md bg-hot-500 hover:bg-hot-400 text-white text-sm font-medium shadow-glow-sm self-start md:self-auto"
          >
            Update
          </button>
        </form>

        <p className="mt-3 text-xs text-white/50">
          {facilities.length} {facilities.length === 1 ? 'court' : 'courts'}
          {region ? ` in ${region}` : ' in greater LA'} · {bookable} with online
          reservations
        </p>

        <div className="mt-6">
          {facilities.length === 0 ? (
            <div className="card p-8 text-center text-white/60">
              <p>No courts found{region ? ` in ${region}` : ''}.</p>
            </div>
          ) : (
            <ul className="card divide-y divide-ink-line/60">
              {facilities.map((f) => {
                const dirHref = directionsUrl({
                  destLat: f.lat ?? undefined,
                  destLng: f.lng ?? undefined,
                  destAddress:
                    f.address ?? `${f.name}, ${f.city ?? 'Los Angeles'}`,
                });
                return (
                  <li
                    key={f.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {f.name}
                      </p>
                      <p className="text-xs text-white/50">
                        {f.region ?? f.city ?? 'LA'}
                        {f.num_courts ? ` · ${f.num_courts} courts` : ''}
                        {f.surface ? ` · ${f.surface}` : ''}
                        {f.lights ? ' · lights' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-2 sm:shrink-0">
                      <a
                        href={dirHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-white/60 hover:text-white"
                      >
                        Directions ↗
                      </a>
                      {f.booking_url ? (
                        <a
                          href={f.booking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs whitespace-nowrap px-3 py-1.5 rounded-md bg-hot-500/20 text-hot-100 border border-hot-500/30 hover:bg-hot-500/40 hover:text-white transition"
                        >
                          Reserve ↗
                        </a>
                      ) : (
                        <span className="text-[11px] text-white/40 whitespace-nowrap">
                          Drop-in
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
