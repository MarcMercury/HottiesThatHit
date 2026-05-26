import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// POST /api/social/follow  body: { username }
export async function POST(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { username?: string } | null;
  if (!body?.username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const svc = getServiceClient();
  const { data: target } = await svc
    .from('profiles')
    .select('id, username')
    .eq('username', body.username.toLowerCase())
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });
  if (target.id === ctx.user.id) {
    return NextResponse.json({ error: "Can't follow yourself" }, { status: 400 });
  }

  const { error } = await svc
    .from('follows')
    .upsert(
      { follower_id: ctx.user.id, following_id: target.id },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, following: true });
}

// DELETE /api/social/follow?username=...
export async function DELETE(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const username = new URL(req.url).searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const svc = getServiceClient();
  const { data: target } = await svc
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });

  const { error } = await svc
    .from('follows')
    .delete()
    .eq('follower_id', ctx.user.id)
    .eq('following_id', target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, following: false });
}

// GET /api/social/follow?username=... — returns { following, follower_count, following_count }
export async function GET(req: Request) {
  const username = new URL(req.url).searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
  const svc = getServiceClient();
  const { data: target } = await svc
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });

  const [followers, following] = await Promise.all([
    svc.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', target.id),
    svc.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', target.id),
  ]);

  let amFollowing = false;
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (ctx) {
    const { data } = await svc
      .from('follows')
      .select('follower_id')
      .eq('follower_id', ctx.user.id)
      .eq('following_id', target.id)
      .maybeSingle();
    amFollowing = !!data;
  }

  return NextResponse.json({
    following: amFollowing,
    follower_count: followers.count ?? 0,
    following_count: following.count ?? 0,
  });
}
