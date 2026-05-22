import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/PageHeader';
import { getServiceClient } from '@/lib/supabase';
import type { Facility } from '@/components/CourtsMap';

// Leaflet is browser-only — never render on the server.
const CourtsMap = dynamic(() => import('@/components/CourtsMap'), { ssr: false });

export const metadata = { title: 'Find a Court · Hotties That Hit' };
export const revalidate = 300;

async function loadFacilities(): Promise<Facility[]> {
  try {
    const supabase = getServiceClient();

    // Paginate — PostgREST caps each response at db.max_rows (1000), so a
    // single query silently drops everything past row 1000.
    const pageSize = 1000;
    const rows: Array<Record<string, unknown>> = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('facilities')
        .select(
          'id, source_id, external_id, name, address, city, lat, lng, num_courts, surface, lights, category, region, metro, phone, website, online_booking, facility_booking_url, active'
        )
        .eq('active', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('name')
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Array<Record<string, unknown>>));
      if (data.length < pageSize) break;
    }
    if (rows.length === 0) return [];
    const facilities = rows as unknown as Array<Facility & { source_id: string; facility_booking_url: string | null }>;

    const { data: sources } = await supabase
      .from('sources')
      .select('id, name, booking_url');
    const sourceMap = new Map((sources ?? []).map((s) => [s.id, s] as const));

    return facilities.map((f) => {
      const src = sourceMap.get(f.source_id);
      return {
        ...f,
        source_name: src?.name ?? f.source_id,
        booking_url: f.facility_booking_url ?? src?.booking_url ?? null,
      } as Facility;
    });
  } catch {
    return [];
  }
}

export default async function CourtsPage() {
  const facilities = await loadFacilities();

  const stats = {
    total: facilities.length,
    online: facilities.filter((f) => f.online_booking).length,
    free: facilities.filter((f) => f.category === 'Public Open').length,
    la: facilities.filter((f) => f.metro === 'LA').length,
    nyc: facilities.filter((f) => f.metro === 'NYC').length,
  };

  return (
    <main>
      <PageHeader
        eyebrow="Directory"
        title="Find a Court"
        subtitle={
          stats.total > 0
            ? `Every public tennis court in LA \u00b7 NYC \u2014 ${stats.total} facilities (${stats.la} LA / ${stats.nyc} NYC), ${stats.online} bookable online, ${stats.free} free drop-in parks.`
            : `Every public tennis court in LA + NYC. Map seeded from tennismaps.com.`
        }
      />

      <section className="mx-auto max-w-7xl px-4 py-6">
        {facilities.length === 0 ? (
          <div className="card p-8 text-center text-white/60">
            <p className="text-white">No facilities loaded yet.</p>
            <p className="mt-2 text-sm">Run the seed against your Supabase project:</p>
            <code className="mt-3 inline-block rounded bg-ink-soft px-3 py-1 text-hot-300 text-sm">
              psql $SUPABASE_DB_URL -f supabase/seed_la_courts_full.sql
            </code>
          </div>
        ) : (
          <CourtsMap facilities={facilities} />
        )}

        <h2 className="mt-12 mb-4 text-xl font-semibold text-white">LA-area booking systems</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BookingCard
            title="LA City Rec & Parks"
            tagline="9 pay-court centers — Griffith/Riverside, Balboa, Cheviot Hills, Westwood, Poinsettia, Pacific Palisades, Westchester, Van Nuys/Sherman Oaks, Vermont Canyon."
            online="Online (WebTrac account)"
            url="https://reg.recreation.parks.lacity.gov/"
          />
          <BookingCard
            title="LA County Parks"
            tagline="Arcadia County Park, Bonelli, Whittier Narrows. Unincorporated areas + contract cities."
            online="Online via ActiveNet"
            url="https://anc.apm.activecommunities.com/lacountyparks"
          />
          <BookingCard
            title="Beverly Hills"
            tagline="La Cienega Tennis Center (16), Roxbury Park (4), BH High School (6). Resident priority."
            online="Online (resident-priority)"
            url="https://www.beverlyhills.org/departments/communityservices/tennis-pickleball"
          />
          <BookingCard
            title="Santa Monica"
            tagline="Reed Park, Memorial Park, Marine Park, Ocean View. Mostly drop-in; reservations for some."
            online="Online + drop-in"
            url="https://www.santamonica.gov/places/parks"
          />
          <BookingCard
            title="Culver City"
            tagline="Veterans Memorial Park courts. Resident-priority reservations."
            online="Online (ActiveNet)"
            url="https://anc.apm.activecommunities.com/culvercity"
          />
          <BookingCard
            title="Pasadena"
            tagline="Brookside, Victory, Allendale, Washington, Singer parks."
            online="Online + walk-up"
            url="https://www.cityofpasadena.net/parks-and-rec/"
          />
          <BookingCard
            title="Long Beach"
            tagline="Billie Jean King TC (8), El Dorado TC (15), plus 30+ free park courts."
            online="Online via city portal"
            url="https://www.longbeach.gov/park/recreation-programs/sports/tennis/"
          />
          <BookingCard
            title="Calabasas Tennis & Swim"
            tagline="16-court flagship in the West Valley."
            online="Online (PerfectMind)"
            url="https://www.cityofcalabasas.com/government/community-services/calabasas-tennis-swim-center"
          />
          <BookingCard
            title="Glendale"
            tagline="Fremont Park (8), Glorieta Park (4), Pacific Park courts."
            online="Online + phone"
            url="https://www.glendaleca.gov/government/departments/community-services-parks/parks-recreation/tennis-courts"
          />
          <BookingCard
            title="South Bay (MB / Redondo / El Segundo)"
            tagline="Live Oak Park, Mira Costa, Alta Vista TC, ES Rec & Parks TC."
            online="City-by-city"
            url="https://www.citymb.info/departments/parks-and-recreation"
          />
          <BookingCard
            title="Cerritos / La Mirada / Lakewood"
            tagline="Three of the largest reservable centers in southeast LA."
            online="Online (resident-priority)"
            url="https://www.lakewoodcity.org/Recreation-Community-Services/Recreation-Activities/Sports/Tennis"
          />
          <BookingCard
            title="Free park courts (everywhere)"
            tagline={`${stats.free || '~290'} LA-area parks with first-come-first-served drop-in courts.`}
            online="No booking — just show up."
            url="https://www.tennismaps.com/index.asp?regionid=104"
          />
          <BookingCard
            title="Facilitron (LAUSD + colleges)"
            tagline="Rent LAUSD school courts and community-college courts off-hours."
            online="Online rental"
            url="https://www.facilitron.com/search?q=tennis%20los%20angeles"
          />
          <BookingCard
            title="TennisMaps LA"
            tagline="Underlying directory for hidden neighborhood and school courts."
            online="External directory"
            url="https://www.tennismaps.com/index.asp?regionid=104"
          />
        </div>

        <h2 className="mt-12 mb-4 text-xl font-semibold text-white">NYC-area booking systems</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BookingCard
            title="NYC Parks Tennis"
            tagline="Citywide reservation system for all five boroughs \u2014 Central Park, Astoria, Cunningham, Forest Park, Riverside, Lincoln Terrace, Marine Park, and 20+ more."
            online="Online + permit ($100/yr or $15 single play)"
            url="https://www.nycgovparks.org/reg/tennis"
          />
          <BookingCard
            title="USTA Billie Jean King NTC"
            tagline="Flushing Meadows. 22 outdoor + indoor hard / clay courts. Public reservations."
            online="Online (USTA NTC)"
            url="https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html"
          />
          <BookingCard
            title="NYJTL \u2014 Cary Leeds + Harlem"
            tagline="Cary Leeds Center for Tennis & Learning (Bronx, 22 courts) and Harlem Tennis Center."
            online="Online (NYJTL)"
            url="https://nyjtl.org/cary-leeds-center/"
          />
          <BookingCard
            title="City Parks Foundation"
            tagline="Operates Prospect Park Tennis Center (Brooklyn) and youth programs across NYC parks."
            online="Online + drop-in"
            url="https://www.cityparksfoundation.org/sports/"
          />
          <BookingCard
            title="Alley Pond Tennis (Queens)"
            tagline="Indoor + outdoor club at Alley Pond Park, Queens. 16 courts."
            online="Online (club)"
            url="https://alleypondtennis.com/"
          />
          <BookingCard
            title="Nassau County Parks"
            tagline="Eisenhower, Wantagh, North Woodmere, Cow Meadow \u2014 Long Island county-park tennis."
            online="Online + leisure card"
            url="https://www.nassaucountyny.gov/2961/Tennis"
          />
          <BookingCard
            title="NY State Parks \u2014 Bethpage"
            tagline="Bethpage State Park Tennis Center. Public reservations."
            online="Online (state parks)"
            url="https://parks.ny.gov/parks/27/details.aspx"
          />
          <BookingCard
            title="Westchester County Parks"
            tagline="Anthony F Veteran (Yonkers), Mt Vernon, Saxon Woods, Tibbetts Brook."
            online="Online + park-pass"
            url="https://parks.westchestergov.com/sports"
          />
          <BookingCard
            title="Northern NJ municipal"
            tagline="Althea Gibson TC (Meadowlands), Brookdale Park, Nishuane, Wayne Tennis Complex, Hudson County parks."
            online="City-by-city"
            url="https://www.essexcountynj.org/parks/"
          />
          <BookingCard
            title="Free park courts (NYC area)"
            tagline={`${stats.nyc ? Math.max(stats.nyc - 60, 400) : '~500'} drop-in park courts \u2014 NYC city courts require a Parks tennis permit.`}
            online="Permit required (NYC) / drop-in (suburbs)"
            url="https://www.nycgovparks.org/permits/tennis-permits"
          />
          <BookingCard
            title="Tennis in Manhattan"
            tagline="Curated guide to every public and private court in Manhattan \u2014 permits, indoor clubs, bubbles, and seasonal courts."
            online="External directory"
            url="https://tennisinmanhattan.com/"
          />
          <BookingCard
            title="TennisMaps NYC"
            tagline="Underlying directory for the NYC metro \u2014 includes Long Island, Westchester, and northern NJ."
            online="External directory"
            url="https://www.tennismaps.com/index.asp?regionid=146"
          />
        </div>

        <p className="mt-10 text-center text-xs text-white/40">
          Marker data seeded from <a href="https://www.tennismaps.com/index.asp?regionid=104" className="text-hot-300/80 hover:text-hot-300">tennismaps.com</a>{' '}
          (LA region 104 + NYC region 146) and Hotties That Hit&apos;s own scrapers. Spot something missing or wrong?{' '}
          <a href="mailto:hello@slapp.fun" className="text-hot-300/80 hover:text-hot-300">hello@slapp.fun</a>.
        </p>
      </section>
    </main>
  );
}

function BookingCard({
  title,
  tagline,
  online,
  url,
}: {
  title: string;
  tagline: string;
  online: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-5 hover:border-hot-500/60 hover:shadow-glow-sm transition block"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="chip whitespace-nowrap">{online}</span>
      </div>
      <p className="mt-2 text-sm text-white/60">{tagline}</p>
      <p className="mt-3 text-xs text-hot-300">Open booking site →</p>
    </a>
  );
}
