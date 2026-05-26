import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';
import { getDailyForecast, describeWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';

// Shape stored in journal_entries.weather (jsonb).
interface WeatherSnapshot {
  date: string;
  highF: number;
  lowF: number;
  precipPct: number;
  label: string;
  emoji: string;
}

// Vocabularies enforced by DB check constraints.
const HOW_PLAYED = new Set(['great', 'good', 'ok', 'off']);
const SHOTS = new Set([
  'forehand','backhand','serve','volley','return','overhead','slice','dropshot','movement','mental',
]);

interface PatchBody {
  won?: boolean | null;
  how_i_played?: string | null;
  opponents_played?: string | null;
  strongest_shot?: string | null;
  work_on?: string | null;
  notes?: string | null;
}

interface ParticipantWithEvent {
  event_id: string;
  is_host: boolean;
  event: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    facility_id: string;
    facility: { id: string; lat: number | null; lng: number | null } | null;
  } | null;
}

// Backfill journal entries for any past open-play event the user attended that
// doesn't already have one.  Idempotent and cheap thanks to the unique (user, event) index.
async function backfillForUser(userId: string) {
  const svc = getServiceClient();
  const now = new Date().toISOString();

  const { data: parts } = await svc
    .from('open_play_participants')
    .select(
      `event_id, is_host,
       event:open_play_events!event_id (
         id, start_time, end_time, status, facility_id,
         facility:facilities!facility_id ( id, lat, lng )
       )`
    )
    .eq('user_id', userId);

  const rows = ((parts ?? []) as unknown as ParticipantWithEvent[]).filter(
    (p) => p.event && p.event.end_time < now && p.event.status !== 'cancelled',
  );
  if (rows.length === 0) return;

  // Skip events that already have an entry.
  const { data: existing } = await svc
    .from('journal_entries')
    .select('event_id')
    .eq('user_id', userId)
    .in('event_id', rows.map((r) => r.event_id));
  const have = new Set((existing ?? []).map((e) => e.event_id as string));
  const todo = rows.filter((r) => !have.has(r.event_id));
  if (todo.length === 0) return;

  // Build inserts (best-effort weather snapshot — silent failure is fine).
  const inserts = await Promise.all(
    todo.map(async (r) => {
      const ev = r.event!;
      let weather: WeatherSnapshot | null = null;
      const f = ev.facility;
      if (f?.lat != null && f?.lng != null) {
        const date = ev.start_time.slice(0, 10);
        const daily = await getDailyForecast(f.lat, f.lng, date);
        if (daily) {
          const w = describeWeather(daily.weatherCode);
          weather = {
            date: daily.date,
            highF: daily.highF,
            lowF: daily.lowF,
            precipPct: daily.precipPct,
            label: w.label,
            emoji: w.emoji,
          };
        }
      }
      return {
        user_id: userId,
        event_id: ev.id,
        facility_id: ev.facility_id,
        played_at: ev.start_time,
        weather,
      };
    }),
  );

  await svc
    .from('journal_entries')
    .upsert(inserts, { onConflict: 'user_id,event_id', ignoreDuplicates: true });
}

// GET /api/journal — auth required. Auto-backfills then returns all entries
// for the signed-in user, newest first, with event + facility details.
export async function GET(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  await backfillForUser(ctx.user.id).catch(() => undefined);

  const svc = getServiceClient();
  const { data, error } = await svc
    .from('journal_entries')
    .select(
      `id, event_id, facility_id, played_at,
       won, how_i_played, opponents_played, strongest_shot, work_on,
       notes, weather, created_at, updated_at,
       facility:facilities!facility_id ( id, name, city, region ),
       event:open_play_events!event_id (
         id, start_time, end_time, court_number, title,
         participants:open_play_participants (
           user_id, is_host,
           user:profiles!user_id ( id, username, image_url_1, ntrp_rating )
         )
       )`,
    )
    .eq('user_id', ctx.user.id)
    .order('played_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

// PATCH /api/journal — body { id, ...fields }. Owner only.
export async function PATCH(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | (PatchBody & { id?: string })
    | null;
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  if ('won' in body) allowed.won = body.won ?? null;
  if ('how_i_played' in body) {
    if (body.how_i_played != null && !HOW_PLAYED.has(body.how_i_played))
      return NextResponse.json({ error: 'invalid how_i_played' }, { status: 400 });
    allowed.how_i_played = body.how_i_played ?? null;
  }
  if ('opponents_played' in body) {
    if (body.opponents_played != null && !HOW_PLAYED.has(body.opponents_played))
      return NextResponse.json({ error: 'invalid opponents_played' }, { status: 400 });
    allowed.opponents_played = body.opponents_played ?? null;
  }
  if ('strongest_shot' in body) {
    if (body.strongest_shot != null && !SHOTS.has(body.strongest_shot))
      return NextResponse.json({ error: 'invalid strongest_shot' }, { status: 400 });
    allowed.strongest_shot = body.strongest_shot ?? null;
  }
  if ('work_on' in body) {
    if (body.work_on != null && !SHOTS.has(body.work_on))
      return NextResponse.json({ error: 'invalid work_on' }, { status: 400 });
    allowed.work_on = body.work_on ?? null;
  }
  if ('notes' in body) {
    const n = (body.notes ?? '').trim();
    allowed.notes = n.length === 0 ? null : n.slice(0, 4000);
  }

  if (Object.keys(allowed).length === 0)
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });

  const svc = getServiceClient();
  const { error } = await svc
    .from('journal_entries')
    .update(allowed)
    .eq('id', body.id)
    .eq('user_id', ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/journal?id=... — owner only.
export async function DELETE(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const svc = getServiceClient();
  const { error } = await svc
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
