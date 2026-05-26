import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

interface CreateBody {
  facility_id?: string | null;
  starts_at?: string;
  ends_at?: string | null;
  message?: string | null;
}

// GET /api/social/pings?scope=feed|all|mine
//  feed (default) = pings from users the caller follows, including self
//  all  = every upcoming ping (public discovery)
//  mine = caller's own pings
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'feed';
  const svc = getServiceClient();
  const now = new Date().toISOString();

  let q = svc
    .from('availability_pings')
    .select(
      `id, user_id, facility_id, starts_at, ends_at, message, created_at,
       user:profiles!user_id ( id, username, image_url_1, ntrp_rating ),
       facility:facilities!facility_id ( id, name, city, region )`,
    )
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(100);

  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));

  if (scope === 'mine') {
    if (!ctx) return NextResponse.json({ pings: [] });
    q = q.eq('user_id', ctx.user.id);
  } else if (scope === 'feed') {
    if (!ctx) return NextResponse.json({ pings: [] });
    const { data: follows } = await svc
      .from('follows')
      .select('following_id')
      .eq('follower_id', ctx.user.id);
    const ids = [ctx.user.id, ...(follows ?? []).map((f) => f.following_id as string)];
    q = q.in('user_id', ids);
  }
  // scope=all: no filter

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pings: data ?? [] });
}

// POST /api/social/pings
export async function POST(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.starts_at) {
    return NextResponse.json({ error: 'starts_at required' }, { status: 400 });
  }
  const start = new Date(body.starts_at);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Invalid starts_at' }, { status: 400 });
  }
  if (start.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: 'starts_at is in the past' }, { status: 400 });
  }
  let end: Date | null = null;
  if (body.ends_at) {
    end = new Date(body.ends_at);
    if (Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
    }
  }
  const msg = body.message?.trim();
  if (msg && msg.length > 500) {
    return NextResponse.json({ error: 'message too long' }, { status: 400 });
  }

  const svc = getServiceClient();
  if (body.facility_id) {
    const { data: fac } = await svc
      .from('facilities')
      .select('id')
      .eq('id', body.facility_id)
      .maybeSingle();
    if (!fac) return NextResponse.json({ error: 'Unknown facility' }, { status: 400 });
  }

  const { data, error } = await svc
    .from('availability_pings')
    .insert({
      user_id: ctx.user.id,
      facility_id: body.facility_id ?? null,
      starts_at: start.toISOString(),
      ends_at: end?.toISOString() ?? null,
      message: msg || null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ping: data });
}

// DELETE /api/social/pings?id=...
export async function DELETE(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const svc = getServiceClient();
  const { error } = await svc
    .from('availability_pings')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
