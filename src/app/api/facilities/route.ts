// GET /api/facilities
// Returns the full directory of tennis facilities with location, category,
// region, online-booking status, phone, and booking URL. Powers the courts map.

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sourceId = sp.get('source');
  const region = sp.get('region');
  const onlineOnly = sp.get('online') === 'true';

  const supabase = getServiceClient();

  let q = supabase
    .from('facilities')
    .select(
      'id, source_id, external_id, name, address, city, lat, lng, num_courts, surface, lights, category, region, phone, website, online_booking, facility_booking_url, tm_id, active'
    )
    .eq('active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('name');

  if (sourceId) q = q.eq('source_id', sourceId);
  if (region) q = q.eq('region', region);
  if (onlineOnly) q = q.eq('online_booking', true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull source booking URLs in one go for facilities that don't override.
  const sources = await supabase.from('sources').select('id, name, booking_url, scraper_type, enabled');
  const sourceMap = new Map((sources.data ?? []).map((s) => [s.id, s] as const));

  const facilities = (data ?? []).map((f) => {
    const src = sourceMap.get(f.source_id);
    return {
      ...f,
      source_name: src?.name ?? f.source_id,
      booking_url: f.facility_booking_url ?? src?.booking_url ?? null,
    };
  });

  return NextResponse.json({ facilities, count: facilities.length });
}
