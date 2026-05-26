import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/admin/court-notes?status=pending|approved|rejected (default pending)
export async function GET(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const status = new URL(req.url).searchParams.get('status') ?? 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data, error } = await svc
    .from('court_notes')
    .select(
      `id, body, status, created_at, updated_at, approved_at,
       facility:facilities!facility_id ( id, name, city, region ),
       author:profiles!author_id ( id, username )`,
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

// PATCH /api/admin/court-notes  body: { id, body?, status? }
// Admin can edit text and/or flip status to approved|rejected|pending.
export async function PATCH(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { id?: string; body?: string; status?: string }
    | null;
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.body === 'string') {
    const t = body.body.trim();
    if (t.length === 0 || t.length > 1000) {
      return NextResponse.json({ error: 'body 1..1000 chars' }, { status: 400 });
    }
    patch.body = t;
  }
  if (body.status) {
    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === 'approved') {
      patch.approved_by = ctx.user.id;
      patch.approved_at = new Date().toISOString();
    } else {
      patch.approved_at = null;
      patch.approved_by = null;
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const svc = getServiceClient();
  const { error } = await svc.from('court_notes').update(patch).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/court-notes?id=...
export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const svc = getServiceClient();
  const { error } = await svc.from('court_notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
