// Runner: takes a Scraper, executes it, and upserts results into Supabase.
// Used by both the CLI (npm run scrape:la-rec) and the cron API route.

import { Scraper, ScrapeResult } from '../lib/types';
import { getServiceClient } from '../lib/supabase';

export async function runScraper(scraper: Scraper, daysAhead = 7) {
  const supabase = getServiceClient();

  // Open a scrape_runs row so we can see what's happening even if the run dies.
  const { data: run, error: runErr } = await supabase
    .from('scrape_runs')
    .insert({ source_id: scraper.sourceId, status: 'running' })
    .select()
    .single();
  if (runErr) throw runErr;

  try {
    const result: ScrapeResult = await scraper.scrape(daysAhead);

    // Upsert facilities first so we have IDs to reference from slots.
    const facilityRows = result.facilities.map((f) => ({
      source_id: scraper.sourceId,
      external_id: f.externalId,
      name: f.name,
      address: f.address ?? null,
      city: f.city ?? null,
      lat: f.lat ?? null,
      lng: f.lng ?? null,
      num_courts: f.numCourts ?? null,
      surface: f.surface ?? null,
      lights: f.lights ?? false,
    }));

    const { data: facilityData, error: facErr } = await supabase
      .from('facilities')
      .upsert(facilityRows, { onConflict: 'source_id,external_id' })
      .select('id, external_id');
    if (facErr) throw facErr;

    const externalIdToId = new Map<string, string>();
    for (const f of facilityData ?? []) {
      externalIdToId.set(f.external_id, f.id);
    }

    // Upsert slots in batches — Supabase has a payload size limit.
    const slotRows = result.slots
      .map((s) => {
        const facilityId = externalIdToId.get(s.facilityExternalId);
        if (!facilityId) return null;
        return {
          facility_id: facilityId,
          court_number: s.courtNumber ?? null,
          start_time: s.startTime.toISOString(),
          end_time: s.endTime.toISOString(),
          available: s.available,
          price_cents: s.priceCents ?? null,
          booking_url: s.bookingUrl ?? null,
          scraped_at: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const BATCH = 500;
    for (let i = 0; i < slotRows.length; i += BATCH) {
      const batch = slotRows.slice(i, i + BATCH);
      const { error: slotErr } = await supabase
        .from('slots')
        .upsert(batch, { onConflict: 'facility_id,court_number,start_time' });
      if (slotErr) throw slotErr;
    }

    const available = slotRows.filter((s) => s.available).length;

    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        slots_found: slotRows.length,
        slots_available: available,
      })
      .eq('id', run.id);

    return { facilities: facilityRows.length, slots: slotRows.length, available };
  } catch (err) {
    await supabase
      .from('scrape_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq('id', run.id);
    throw err;
  }
}
