// Apply 2026-05 booking-URL fixes via supabase-js (service role).
// Usage: pnpm tsx scripts/apply_booking_url_fixes.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_DB_SCHEMA ?? 'hotties' },
});

type SourcePatch = { id: string; booking_url: string; scraper_type?: string; notes?: string; name?: string };
type FacilityPatch = {
  match: { source_id: string; external_id: string | string[] };
  set: { facility_booking_url: string; online_booking?: boolean };
};

const sources: SourcePatch[] = [
  { id: 'long_beach',     booking_url: 'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis', scraper_type: 'activenet', notes: 'ActiveNet (LB Rec Connect). Billie Jean King + El Dorado online booking.' },
  { id: 'lakewood',       booking_url: 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services', notes: 'Lakewood Tennis Center. Resident-priority booking via city rec.' },
  { id: 'manhattan_beach', booking_url: 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis', notes: 'Live Oak + Mira Costa. citymb.info domain retired; now manhattanbeach.gov.' },
  { id: 'redondo_beach',  booking_url: 'https://www.redondo.org/', notes: 'Alta Vista Tennis Center. Phone reservations primary.' },
  { id: 'el_segundo',     booking_url: 'https://secure.rec1.com/CA/el-segundo-ca/catalog', scraper_type: 'rec1', notes: 'Rec1 catalog. Online booking via El Segundo Recreation, Parks & Library.' },
  { id: 'san_marino',     name: 'San Marino Community Services', booking_url: 'https://secure.rec1.com/CA/san-marino-ca/catalog', scraper_type: 'rec1', notes: 'Rec1 catalog. Old sanmarinotenniscenter.com retired.' },
  { id: 'cerritos',       booking_url: 'https://www.cerritos.gov/', notes: 'City of Cerritos (cerritos.us → cerritos.gov). Cerritos Tennis Center: resident booking.' },
  { id: 'la_mirada',      booking_url: 'https://secure.rec1.com/CA/la-mirada-community-services/catalog', scraper_type: 'rec1', notes: 'Rec1 catalog (La Mirada Community Services). cityoflamirada.org retired.' },
  { id: 'downey',         booking_url: 'https://anc.apm.activecommunities.com/cityofdowney/activity/search?activity_keyword=tennis', scraper_type: 'activenet', notes: 'ActiveNet (City of Downey). Independence Park Tennis Center.' },
  { id: 'ucla',           name: 'UCLA Recreation', booking_url: 'https://recreation.ucla.edu/facilities/los-angeles-tennis-center', notes: 'UCLA Recreation (uclatenniscenter.com retired). Member club; limited public access.' },
];

// Beverly Hills source may not exist yet — upsert.
const beverlyHills: SourcePatch & { name: string } = {
  id: 'beverly_hills',
  name: 'City of Beverly Hills',
  booking_url: 'https://www.beverlyhills.org/',
  scraper_type: 'custom',
  notes: 'La Cienega + Roxbury + Beverly Hills HS. Resident-priority booking; phone primary.',
};

const facilities: FacilityPatch[] = [
  { match: { source_id: 'redondo_beach', external_id: 'redondo_beach:alta_vista_tennis_center' },
    set:   { facility_booking_url: 'https://www.redondo.org/' } },
  { match: { source_id: 'long_beach', external_id: ['long_beach:billie_jean_king_tennis_center', 'long_beach:el_dorado_tennis_center'] },
    set:   { facility_booking_url: 'https://anc.apm.activecommunities.com/lbparks/activity/search?activity_keyword=tennis' } },
  { match: { source_id: 'lakewood', external_id: 'lakewood:lakewood_tennis_center' },
    set:   { facility_booking_url: 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services' } },
  { match: { source_id: 'manhattan_beach', external_id: ['manhattan_beach:live_oak_park_tennis_center', 'manhattan_beach:mira_costa_high_school'] },
    set:   { facility_booking_url: 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis' } },
  { match: { source_id: 'el_segundo', external_id: 'el_segundo:el_segundo_parks_recreation_tennis_center' },
    set:   { facility_booking_url: 'https://secure.rec1.com/CA/el-segundo-ca/catalog', online_booking: true } },
  { match: { source_id: 'san_marino', external_id: 'san_marino:san_marino_tennis_center' },
    set:   { facility_booking_url: 'https://secure.rec1.com/CA/san-marino-ca/catalog' } },
  { match: { source_id: 'cerritos', external_id: 'cerritos:cerritos_tennis_center' },
    set:   { facility_booking_url: 'https://www.cerritos.gov/' } },
  { match: { source_id: 'la_mirada', external_id: 'la_mirada:la_mirada_tennis_center' },
    set:   { facility_booking_url: 'https://secure.rec1.com/CA/la-mirada-community-services/catalog' } },
  { match: { source_id: 'downey', external_id: 'downey:independence_park_tennis_center' },
    set:   { facility_booking_url: 'https://anc.apm.activecommunities.com/cityofdowney/activity/search?activity_keyword=tennis' } },
  { match: { source_id: 'ucla', external_id: 'ucla:los_angeles_tennis_center' },
    set:   { facility_booking_url: 'https://recreation.ucla.edu/facilities/los-angeles-tennis-center' } },
  { match: { source_id: 'beverly_hills', external_id: ['beverly_hills:la_cienega_tennis_center', 'beverly_hills:roxbury_memorial_park', 'beverly_hills:beverly_hills_high_school'] },
    set:   { facility_booking_url: 'https://www.beverlyhills.org/' } },
];

async function main() {
  // 1. Upsert Beverly Hills source row.
  {
    const { error } = await sb.from('sources').upsert(beverlyHills, { onConflict: 'id' });
    if (error) throw error;
    console.log('upsert source beverly_hills');
  }

  // 2. Update sources.
  for (const p of sources) {
    const { id, ...patch } = p;
    const { error, count } = await sb.from('sources').update(patch, { count: 'exact' }).eq('id', id);
    if (error) throw new Error(`source ${id}: ${error.message}`);
    console.log(`source ${id}: updated rows=${count ?? '?'}`);
  }

  // 3. Update facilities.
  for (const f of facilities) {
    const { source_id, external_id } = f.match;
    let q = sb.from('facilities').update(f.set, { count: 'exact' }).eq('source_id', source_id);
    q = Array.isArray(external_id) ? q.in('external_id', external_id) : q.eq('external_id', external_id);
    const { error, count } = await q;
    if (error) throw new Error(`facility ${source_id}/${external_id}: ${error.message}`);
    console.log(`facility ${source_id} (${Array.isArray(external_id) ? external_id.length + ' ids' : external_id}): updated rows=${count ?? '?'}`);
  }

  // 4. Verify a few.
  const { data: vs, error: ve } = await sb.from('sources').select('id, booking_url').order('id');
  if (ve) throw ve;
  console.log('\nFinal sources:');
  for (const s of vs ?? []) console.log(`  ${s.id.padEnd(18)} ${s.booking_url}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
