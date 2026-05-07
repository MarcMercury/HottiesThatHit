// Vercel cron endpoint. Scheduled via vercel.json.
// Vercel calls this with the CRON_SECRET in the Authorization header.
//
// Each scraper's source row in hotties.sources controls whether it runs.
// To pause a source: set hotties.sources.enabled = false.

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/supabase';
import { laRecScraper } from '../../../../scrapers/la_rec';
import { runScraper } from '../../../../scrapers/runner';

export const maxDuration = 300; // seconds. Vercel Pro allows up to 300s; LA scrape needs ~120s.
export const dynamic = 'force-dynamic';

const RUN_LIST: Array<{ id: string; run: () => Promise<unknown> }> = [
  { id: 'la_rec', run: () => runScraper(laRecScraper, 8) },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: enabledRows } = await supabase
    .from('sources')
    .select('id')
    .eq('enabled', true);
  const enabled = new Set((enabledRows ?? []).map((r) => r.id as string));

  const results: Record<string, unknown> = {};
  for (const s of RUN_LIST) {
    if (!enabled.has(s.id)) {
      results[s.id] = { skipped: 'source disabled' };
      continue;
    }
    try {
      results[s.id] = await s.run();
    } catch (err) {
      results[s.id] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, results });
}
