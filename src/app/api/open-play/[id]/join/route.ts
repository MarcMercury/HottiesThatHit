import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// POST /api/open-play/[id]/join  — claim an open spot.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!ctx.profile) {
    return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data: event, error: evErr } = await svc
    .from('open_play_events')
    .select('id, total_spots, status, end_time')
    .eq('id', params.id)
    .maybeSingle();
  if (evErr || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status === 'cancelled') {
    return NextResponse.json({ error: 'Event is cancelled' }, { status: 400 });
  }
  if (new Date(event.end_time).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Event has ended' }, { status: 400 });
  }

  const { count, error: countErr } = await svc
    .from('open_play_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('event_id', event.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= event.total_spots) {
    return NextResponse.json({ error: 'Event is full' }, { status: 400 });
  }

  const { error: insErr } = await svc.from('open_play_participants').insert({
    event_id: event.id,
    user_id: ctx.user.id,
    is_host: false,
  });
  if (insErr) {
    // Most likely already a participant — surface a friendly error.
    if (insErr.code === '23505') {
      return NextResponse.json({ error: "You're already in" }, { status: 400 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // If we just filled the last spot, mark full.
  if ((count ?? 0) + 1 >= event.total_spots) {
    await svc.from('open_play_events').update({ status: 'full' }).eq('id', event.id);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/open-play/[id]/join  — leave the event.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const svc = getServiceClient();
  const { data: event } = await svc
    .from('open_play_events')
    .select('id, host_id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Host can't leave their own event — they should cancel it instead.
  if (event.host_id === ctx.user.id) {
    return NextResponse.json(
      { error: "You're the host — cancel the event instead" },
      { status: 400 },
    );
  }

  const { error } = await svc
    .from('open_play_participants')
    .delete()
    .eq('event_id', event.id)
    .eq('user_id', ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reopen if it was previously full.
  if (event.status === 'full') {
    await svc.from('open_play_events').update({ status: 'open' }).eq('id', event.id);
  }

  return NextResponse.json({ ok: true });
}
