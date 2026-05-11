import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// DELETE /api/open-play/[id]  — host or admin only. Cancels (soft-delete) the event.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const svc = getServiceClient();
  const { data: event, error: getErr } = await svc
    .from('open_play_events')
    .select('id, host_id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (getErr || !event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const isAdmin = !!ctx.profile?.is_admin;
  if (event.host_id !== ctx.user.id && !isAdmin) {
    return NextResponse.json({ error: 'Not your event' }, { status: 403 });
  }

  const { error } = await svc
    .from('open_play_events')
    .update({ status: 'cancelled' })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
