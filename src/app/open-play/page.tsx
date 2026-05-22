import { PageHeader } from '@/components/PageHeader';
import { getServiceClient } from '@/lib/supabase';
import { OpenPlayClient, type OpenPlayEvent, type FacilityOption } from './OpenPlayClient';

export const metadata = { title: 'Open Play · Hotties That Hit' };
export const dynamic = 'force-dynamic';

async function loadInitial(): Promise<{
  events: OpenPlayEvent[];
  facilities: FacilityOption[];
}> {
  const svc = getServiceClient();
  const now = new Date().toISOString();

  const evP = svc
    .from('open_play_events')
    .select(
      `id, host_id, facility_id, court_number, start_time, end_time,
       total_spots, min_ntrp, max_ntrp, title, notes, status, created_at,
       host:profiles!host_id ( id, username, ntrp_rating, image_url_1 ),
       facility:facilities!facility_id ( id, name, address, city, region, lat, lng ),
       participants:open_play_participants (
         user_id, joined_at, is_host,
         user:profiles!user_id ( id, username, ntrp_rating, image_url_1 )
       )`,
    )
    .gte('end_time', now)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })
    .limit(200);

  // Paginate facilities — PostgREST caps responses at db.max_rows (1000 by
  // default), so .limit() alone can't fetch all ~3k active facilities.
  async function loadAllFacilities(): Promise<FacilityOption[]> {
    const pageSize = 1000;
    const out: FacilityOption[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await svc
        .from('facilities')
        .select('id, name, city, region, num_courts')
        .eq('active', true)
        .order('name')
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      out.push(...(data as FacilityOption[]));
      if (data.length < pageSize) break;
    }
    return out;
  }

  const [evRes, facilities] = await Promise.all([evP, loadAllFacilities()]);

  return {
    events: (evRes.data ?? []) as unknown as OpenPlayEvent[],
    facilities,
  };
}

export default async function OpenPlayPage() {
  const { events, facilities } = await loadInitial();

  return (
    <main>
      <PageHeader
        eyebrow="Open Play"
        title="Open Play"
        subtitle="Post a match you've set up. Claim a spot in someone else's. Tennis with the squad."
      />
      <section className="mx-auto max-w-5xl px-4 py-8">
        <OpenPlayClient initialEvents={events} facilities={facilities} />
      </section>
    </main>
  );
}
