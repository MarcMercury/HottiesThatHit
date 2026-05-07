import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = getServiceClient();
  const { data, error } = await svc
    .from('profiles')
    .select(
      'id, username, email, ntrp_rating, city, is_admin, image_url_1, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { id?: string; is_admin?: boolean; ntrp_rating?: number | null }
    | null;
  if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.is_admin === 'boolean') update.is_admin = body.is_admin;
  if (body.ntrp_rating === null || typeof body.ntrp_rating === 'number') {
    update.ntrp_rating = body.ntrp_rating;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const svc = getServiceClient();
  const { error } = await svc.from('profiles').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (id === ctx.user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  const svc = getServiceClient();
  // Deleting the auth user cascades into hotties.profiles via the FK.
  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
