// Vercel cron endpoint. Scheduled via vercel.json.
// Vercel calls this with the CRON_SECRET in the Authorization header.

import { NextRequest, NextResponse } from 'next/server';
import { laRecScraper } from '../../../../scrapers/la_rec';
import { runScraper } from '../../../../scrapers/runner';

export const maxDuration = 60; // seconds. Requires Vercel Pro for >10s.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` automatically when configured.
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  try {
    results.la_rec = await runScraper(laRecScraper, 7);
  } catch (err) {
    results.la_rec = { error: err instanceof Error ? err.message : String(err) };
  }
  // Add more scrapers here as we build them.

  return NextResponse.json({ ok: true, results });
}
