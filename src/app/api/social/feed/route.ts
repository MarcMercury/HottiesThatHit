import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/social/feed
// Activity feed from users the caller follows (plus self). Mixes:
//   - upcoming availability pings
//   - upcoming Open Play events they host or joined
//   - recent court check-ins (favorited a court)
// Newest / soonest items first.  Max 100 mixed events.
export async function GET(req: Request) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ items: [] });

  const svc = getServiceClient();
  const { data: follows } = await svc
    .from('follows')
    .select('following_id')
    .eq('follower_id', ctx.user.id);
  const userIds = [ctx.user.id, ...(follows ?? []).map((f) => f.following_id as string)];

  const now = new Date().toISOString();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [pingsRes, eventsRes, favsRes] = await Promise.all([
    svc
      .from('availability_pings')
      .select(
        `id, user_id, facility_id, starts_at, ends_at, message, created_at,
         user:profiles!user_id ( id, username, image_url_1 ),
         facility:facilities!facility_id ( id, name, city, region )`,
      )
      .in('user_id', userIds)
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(50),
    svc
      .from('open_play_events')
      .select(
        `id, host_id, facility_id, start_time, end_time, total_spots, title, status, created_at,
         host:profiles!host_id ( id, username, image_url_1 ),
         facility:facilities!facility_id ( id, name, city, region )`,
      )
      .in('host_id', userIds)
      .gte('end_time', now)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })
      .limit(50),
    svc
      .from('favorites')
      .select(
        `user_id, facility_id, created_at,
         user:profiles!user_id ( id, username, image_url_1 ),
         facility:facilities!facility_id ( id, name, city, region )`,
      )
      .in('user_id', userIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const items: Array<{
    kind: 'ping' | 'event' | 'favorite';
    sortKey: string;
    data: unknown;
  }> = [];
  for (const p of pingsRes.data ?? [])
    items.push({ kind: 'ping', sortKey: p.starts_at, data: p });
  for (const e of eventsRes.data ?? [])
    items.push({ kind: 'event', sortKey: e.start_time, data: e });
  for (const f of favsRes.data ?? [])
    items.push({ kind: 'favorite', sortKey: f.created_at, data: f });

  items.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  return NextResponse.json({ items: items.slice(0, 100) });
}
