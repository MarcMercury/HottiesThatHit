import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/facilities/[id]/rating
// Returns the average + count + (if signed in) the caller's own rating.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const svc = getServiceClient();

  const { data: summary } = await svc
    .from('facility_rating_summary')
    .select('avg_stars, rating_count')
    .eq('facility_id', params.id)
    .maybeSingle();

  let mine: number | null = null;
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (ctx) {
    const { data } = await svc
      .from('court_ratings')
      .select('stars')
      .eq('facility_id', params.id)
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    mine = data?.stars ?? null;
  }

  return NextResponse.json({
    avg_stars: summary?.avg_stars != null ? Number(summary.avg_stars) : null,
    rating_count: summary?.rating_count ?? 0,
    my_stars: mine,
  });
}

// POST /api/facilities/[id]/rating  body: { stars: 1..5 | null }
// Upserts the caller's rating. stars=null deletes.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { stars?: number | null } | null;
  const stars = body?.stars;

  const svc = getServiceClient();

  if (stars == null) {
    const { error } = await svc
      .from('court_ratings')
      .delete()
      .eq('user_id', ctx.user.id)
      .eq('facility_id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, my_stars: null });
  }

  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars must be 1..5' }, { status: 400 });
  }

  // Verify facility exists.
  const { data: fac } = await svc
    .from('facilities')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!fac) return NextResponse.json({ error: 'Unknown facility' }, { status: 404 });

  const { error } = await svc
    .from('court_ratings')
    .upsert(
      { user_id: ctx.user.id, facility_id: params.id, stars },
      { onConflict: 'user_id,facility_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, my_stars: stars });
}
