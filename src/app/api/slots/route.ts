// GET /api/slots?date=2026-05-07&minHour=17&maxHour=21&city=Los+Angeles
// Returns available slots, joined with facility info.

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date'); // YYYY-MM-DD; defaults to today + 7 days range
  const minHour = sp.get('minHour') ? Number(sp.get('minHour')) : 6;
  const maxHour = sp.get('maxHour') ? Number(sp.get('maxHour')) : 22;
  const city = sp.get('city');
  const sourceId = sp.get('source');
  const region = sp.get('region');

  const supabase = getServiceClient();

  // Build the query incrementally.
  let q = supabase
    .from('slots')
    .select(`
      id, court_number, start_time, end_time, available, price_cents, booking_url,
      facility:facilities!inner ( id, name, address, city, source_id, num_courts, lights, surface, lat, lng, region, category, online_booking, facility_booking_url )
    `)
    .eq('available', true)
    .order('start_time', { ascending: true })
    .limit(500);

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    q = q.gte('start_time', start.toISOString()).lte('start_time', end.toISOString());
  } else {
    q = q.gte('start_time', new Date().toISOString());
  }

  if (city) q = q.eq('facility.city', city);
  if (region) q = q.eq('facility.region', region);
  if (sourceId) q = q.eq('facility.source_id', sourceId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by hour client-side on the server (Supabase can't easily do hour-extract on tz-aware columns).
  const filtered = (data ?? []).filter((s) => {
    const h = new Date(s.start_time).getHours();
    return h >= minHour && h < maxHour;
  });

  return NextResponse.json({ slots: filtered });
}
