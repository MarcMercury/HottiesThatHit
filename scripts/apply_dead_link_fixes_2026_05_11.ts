// Apply 2026-05-11 dead-court-link fixes via supabase-js (service role).
// Mirrors supabase/fix_dead_court_links_2026_05_11.sql.
//
// Usage:
//   node --env-file=.env.local --import tsx scripts/apply_dead_link_fixes_2026_05_11.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_DB_SCHEMA ?? 'hotties' },
});

// Facility-level: replace facility_booking_url X → Y everywhere it appears.
const facilityUrlReplacements: Array<{ from: string; to: string; label: string }> = [
  {
    label: 'NYC Parks /reg/tennis (404) → /tennisreservation',
    from: 'https://www.nycgovparks.org/reg/tennis',
    to: 'https://www.nycgovparks.org/tennisreservation',
  },
  {
    label: 'Glendale tennis-courts subpage (404) → community-services-parks',
    from: 'https://www.glendaleca.gov/government/departments/community-services-parks/parks-recreation/tennis-courts',
    to: 'https://www.glendaleca.gov/government/departments/community-services-parks',
  },
  {
    label: 'Lakewood rec subpage (404) → activities/classes/registration',
    from: 'https://www.lakewoodca.gov/government/departments/recreation-and-community-services',
    to: 'https://www.lakewoodca.gov/Things-to-Do/Activities-Classes-Registration',
  },
  {
    label: 'Manhattan Beach leisure-classes/tennis (404) → parks & rec',
    from: 'https://www.manhattanbeach.gov/departments/parks-and-recreation/leisure-classes-and-camps/tennis',
    to: 'https://www.manhattanbeach.gov/departments/parks-and-recreation',
  },
  {
    label: 'Westchester County Parks /sports (404) → new domain root',
    from: 'https://parks.westchestergov.com/sports',
    to: 'https://parks.westchestercountyny.gov/',
  },
  {
    label: 'Essex County NJ /parks/ (404) → root',
    from: 'https://www.essexcountynj.org/parks/',
    to: 'https://www.essexcountynj.org/',
  },
  {
    label: 'North Hempstead /parks-and-recreation (404) → root',
    from: 'https://www.northhempsteadny.gov/parks-and-recreation',
    to: 'https://www.northhempsteadny.gov/',
  },
  {
    label: 'Montclair NJ recreation slug (404) → root',
    from: 'https://www.montclairnjusa.org/government/departments-divisions/recreation-cultural-affairs',
    to: 'https://www.montclairnjusa.org/',
  },
  {
    label: 'Rye NY /departments/recreation (404) → /government/recreation-department',
    from: 'https://www.ryeny.gov/departments/recreation',
    to: 'https://www.ryeny.gov/government/recreation-department',
  },
  {
    label: 'Stamford CT recreation-services (404) → root',
    from: 'https://www.stamfordct.gov/government/departments/recreation-services',
    to: 'https://www.stamfordct.gov/',
  },
  {
    label: 'Wayne Township parks-recreation (404) → root',
    from: 'https://www.waynetownship.com/government/departments/parks-recreation',
    to: 'https://www.waynetownship.com/',
  },
  {
    label: 'City Parks Foundation /sports/prospect-park-tennis-center/ (404) → /play/tennis/',
    from: 'https://www.cityparksfoundation.org/sports/prospect-park-tennis-center/',
    to: 'https://cityparksfoundation.org/play/tennis/',
  },
  {
    label: 'Whittier /government/parks-recreation-and-community-services (404) → root',
    from: 'https://cityofwhittier.org/government/parks-recreation-and-community-services',
    to: 'https://cityofwhittier.org/',
  },
  {
    label: 'Calabasas tennis-swim-center page (404) → city root',
    from: 'https://www.cityofcalabasas.com/government/community-services/calabasas-tennis-swim-center',
    to: 'https://www.cityofcalabasas.com/',
  },
];

// Source-level: change sources.booking_url for `santa_monica`.
const sourceUpdates: Array<{ id: string; patch: Record<string, unknown>; label: string }> = [
  {
    id: 'santa_monica',
    label: 'Santa Monica: Vermont Systems retired → ActiveNet',
    patch: {
      booking_url: 'https://anc.apm.activecommunities.com/santamonicarecreation',
      scraper_type: 'activenet',
    },
  },
];

// Swimply: deactivate the 11 facilities whose listings were deleted (404).
const swimplyDeactivate = [
  'swimply:37378',
  'swimply:39477',
  'swimply:48340',
  'swimply:49682',
  'swimply:51706',
  'swimply:52805',
  'swimply:59441',
  'swimply:59915',
  'swimply:61809',
  'swimply:64028',
  'swimply:75650',
];

async function main() {
  // 1. Source updates.
  for (const s of sourceUpdates) {
    const { error, data } = await sb
      .from('sources')
      .update(s.patch)
      .eq('id', s.id)
      .select('id');
    if (error) throw new Error(`source ${s.id}: ${error.message}`);
    console.log(`[source] ${s.id}: ${data?.length ?? 0} row(s)  // ${s.label}`);
  }

  // 2. Facility URL replacements.
  for (const r of facilityUrlReplacements) {
    const { error, data } = await sb
      .from('facilities')
      .update({ facility_booking_url: r.to })
      .eq('facility_booking_url', r.from)
      .select('id');
    if (error) throw new Error(`replace ${r.from}: ${error.message}`);
    console.log(`[facility] ${data?.length ?? 0} row(s)  // ${r.label}`);
  }

  // 3. Deactivate dead Swimply listings.
  {
    const { error, data } = await sb
      .from('facilities')
      .update({ active: false })
      .eq('source_id', 'swimply')
      .in('external_id', swimplyDeactivate)
      .select('id, external_id');
    if (error) throw new Error(`swimply deactivate: ${error.message}`);
    console.log(`[swimply] deactivated ${data?.length ?? 0} listings: ${data?.map((d) => d.external_id).join(', ')}`);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
