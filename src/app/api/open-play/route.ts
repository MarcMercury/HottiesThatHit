import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

interface CreateBody {
  facility_id?: string;
  court_number?: string | null;
  start_time?: string;
  end_time?: string;
  total_spots?: number;
  min_ntrp?: number | null;
  max_ntrp?: number | null;
  title?: string | null;
  notes?: string | null;
  court_reserved?: boolean;
}

// GET /api/open-play
// Query params:
//   scope=upcoming (default) | mine | past | all
//   facility_id=<uuid>
// Returns events with host profile, facility info, and participant list.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'upcoming';
  const facilityFilter = url.searchParams.get('facility_id');

  const svc = getServiceClient();
  const now = new Date().toISOString();

  let q = svc
    .from('open_play_events')
    .select(
      `id, host_id, facility_id, court_number, start_time, end_time,
       total_spots, min_ntrp, max_ntrp, title, notes, court_reserved, status, created_at,
       host:profiles!host_id ( id, username, ntrp_rating, image_url_1 ),
       facility:facilities!facility_id ( id, name, address, city, region, lat, lng ),
       participants:open_play_participants (
         user_id, joined_at, is_host,
         user:profiles!user_id ( id, username, ntrp_rating, image_url_1 )
       )`,
    )
    .order('start_time', { ascending: scope !== 'past' });

  if (scope === 'upcoming') {
    q = q.gte('end_time', now).neq('status', 'cancelled');
  } else if (scope === 'past') {
    q = q.lt('end_time', now);
  } else if (scope === 'mine') {
    const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
    if (!ctx) return NextResponse.json({ events: [] });
    const { data: mine } = await svc
      .from('open_play_participants')
      .select('event_id')
      .eq('user_id', ctx.user.id);
    const ids = (mine ?? []).map((r) => r.event_id);
    if (ids.length === 0) return NextResponse.json({ events: [] });
    q = q.in('id', ids);
  }

  if (facilityFilter) q = q.eq('facility_id', facilityFilter);

  const { data, error } = await q.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

// POST /api/open-play  (auth required)
export async function POST(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!ctx.profile) {
    return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { facility_id, start_time, end_time, total_spots } = body;
  if (!facility_id || !start_time || !end_time || !total_spots) {
    return NextResponse.json(
      { error: 'facility_id, start_time, end_time, total_spots are required' },
      { status: 400 },
    );
  }
  const start = new Date(start_time);
  const end = new Date(end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date(s)' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: 'End must be after start' }, { status: 400 });
  }
  if (start.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: 'Start time is in the past' }, { status: 400 });
  }
  if (total_spots < 2 || total_spots > 16) {
    return NextResponse.json({ error: 'Spots must be 2..16' }, { status: 400 });
  }
  const validNtrp = (n: unknown) =>
    n == null || (typeof n === 'number' && n >= 1 && n <= 7 && (n * 2) % 1 === 0);
  if (!validNtrp(body.min_ntrp) || !validNtrp(body.max_ntrp)) {
    return NextResponse.json({ error: 'NTRP must be 1.0..7.0 in 0.5 steps' }, { status: 400 });
  }
  if (
    typeof body.min_ntrp === 'number' &&
    typeof body.max_ntrp === 'number' &&
    body.max_ntrp < body.min_ntrp
  ) {
    return NextResponse.json({ error: 'Max NTRP must be ≥ min' }, { status: 400 });
  }

  const svc = getServiceClient();

  // Verify facility exists & is active.
  const { data: facility, error: facErr } = await svc
    .from('facilities')
    .select('id, active')
    .eq('id', facility_id)
    .maybeSingle();
  if (facErr || !facility) {
    return NextResponse.json({ error: 'Unknown facility' }, { status: 400 });
  }

  const insert = {
    host_id: ctx.user.id,
    facility_id,
    court_number: body.court_number?.trim() || null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    total_spots,
    min_ntrp: typeof body.min_ntrp === 'number' ? body.min_ntrp : null,
    max_ntrp: typeof body.max_ntrp === 'number' ? body.max_ntrp : null,
    title: body.title?.trim() || null,
    notes: body.notes?.trim() || null,
    court_reserved: body.court_reserved === true,
    status: total_spots <= 1 ? 'full' : 'open',
  };

  const { data: created, error: insErr } = await svc
    .from('open_play_events')
    .insert(insert)
    .select('id')
    .single();
  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  // Auto-add host as participant.
  const { error: partErr } = await svc.from('open_play_participants').insert({
    event_id: created.id,
    user_id: ctx.user.id,
    is_host: true,
  });
  if (partErr) {
    // Roll back the event so we don't leave an orphaned 0-participant event.
    await svc.from('open_play_events').delete().eq('id', created.id);
    return NextResponse.json({ error: partErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
