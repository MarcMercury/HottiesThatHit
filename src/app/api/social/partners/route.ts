import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/social/partners?username=... (defaults to caller)
// Returns frequency-sorted hitting partners derived from shared past Open Play events.
export async function GET(req: Request) {
  const svc = getServiceClient();
  const url = new URL(req.url);
  const username = url.searchParams.get('username');

  let userId: string | null = null;
  if (username) {
    const { data } = await svc
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });
    userId = data.id;
  } else {
    const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
    if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    userId = ctx.user.id;
  }

  const { data, error } = await svc
    .from('hitting_partners')
    .select(
      `partner_id, sessions_together, last_played_at,
       partner:profiles!partner_id ( id, username, ntrp_rating, image_url_1, city )`,
    )
    .eq('user_id', userId)
    .order('sessions_together', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}
