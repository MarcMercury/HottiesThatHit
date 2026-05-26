'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

interface PingItem {
  id: string;
  user_id: string;
  facility_id: string | null;
  starts_at: string;
  ends_at: string | null;
  message: string | null;
  user: { id: string; username: string; image_url_1: string | null } | null;
  facility: { id: string; name: string; city: string | null; region: string | null } | null;
}
interface EventItem {
  id: string;
  host_id: string;
  facility_id: string;
  start_time: string;
  end_time: string;
  total_spots: number;
  title: string | null;
  host: { id: string; username: string; image_url_1: string | null } | null;
  facility: { id: string; name: string; city: string | null; region: string | null } | null;
}
interface FavItem {
  user_id: string;
  facility_id: string;
  created_at: string;
  user: { id: string; username: string; image_url_1: string | null } | null;
  facility: { id: string; name: string; city: string | null; region: string | null } | null;
}
type FeedItem =
  | { kind: 'ping'; sortKey: string; data: PingItem }
  | { kind: 'event'; sortKey: string; data: EventItem }
  | { kind: 'favorite'; sortKey: string; data: FavItem };

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  return (
    <div className="h-9 w-9 overflow-hidden rounded-full border border-ink-line bg-ink-soft shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

function facilityMeta(f: FeedItem['data']['facility']) {
  return f ? [f.region, f.city].filter(Boolean).join(' · ') : '';
}

export function FeedClient() {
  const supabase = getBrowserClient();
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);

  const authedFetch = useCallback(
    async (input: RequestInfo) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers = new Headers();
      if (token) headers.set('authorization', `Bearer ${token}`);
      return fetch(input, { headers, cache: 'no-store' });
    },
    [supabase],
  );

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let alive = true;
    (async () => {
      const res = await authedFetch('/api/social/feed');
      if (!alive) return;
      if (res.ok) {
        const j = (await res.json()) as { items: FeedItem[] };
        setItems(j.items);
      } else {
        setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authedFetch, user]);

  if (!user) {
    return (
      <div className="card mt-6 p-8 text-center">
        <p className="text-white/70">Sign in to see what your friends are up to.</p>
        <Link href="/login" className="btn-primary mt-4 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  if (items === null) return <p className="text-white/60 text-sm mt-6">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="card mt-6 p-8 text-center text-white/60 text-sm">
        Nothing here yet. Find people to follow on the{' '}
        <Link href="/players" className="text-hot-300 hover:text-hot-200">
          Players
        </Link>{' '}
        page.
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {items.map((it) => {
        if (it.kind === 'ping') {
          const p = it.data;
          if (!p.user) return null;
          return (
            <li key={`p-${p.id}`} className="card p-4 flex gap-3">
              <Avatar url={p.user.image_url_1} alt={p.user.username} />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">
                  <Link
                    href={`/players/${p.user.username}`}
                    className="font-semibold hover:text-hot-300"
                  >
                    @{p.user.username}
                  </Link>{' '}
                  <span className="text-white/60">is free</span>{' '}
                  <span className="text-white">
                    {new Date(p.starts_at).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {p.facility && (
                    <>
                      {' '}
                      <span className="text-white/60">at</span>{' '}
                      <span className="text-white">{p.facility.name}</span>
                    </>
                  )}
                </div>
                {p.message && (
                  <p className="text-white/70 text-sm mt-1 whitespace-pre-wrap">{p.message}</p>
                )}
                <div className="text-xs text-white/40 mt-1">{facilityMeta(p.facility)}</div>
              </div>
            </li>
          );
        }
        if (it.kind === 'event') {
          const e = it.data;
          if (!e.host) return null;
          return (
            <li key={`e-${e.id}`} className="card p-4 flex gap-3">
              <Avatar url={e.host.image_url_1} alt={e.host.username} />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">
                  <Link
                    href={`/players/${e.host.username}`}
                    className="font-semibold hover:text-hot-300"
                  >
                    @{e.host.username}
                  </Link>{' '}
                  <span className="text-white/60">is hosting</span>{' '}
                  <Link href="/open-play" className="text-hot-300 hover:text-hot-200">
                    {e.title || `${e.total_spots}-player Open Play`}
                  </Link>
                  {e.facility && (
                    <>
                      {' '}
                      <span className="text-white/60">at</span>{' '}
                      <span className="text-white">{e.facility.name}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {new Date(e.start_time).toLocaleString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </li>
          );
        }
        const f = it.data;
        if (!f.user || !f.facility) return null;
        return (
          <li key={`f-${f.user_id}-${f.facility_id}`} className="card p-4 flex gap-3">
            <Avatar url={f.user.image_url_1} alt={f.user.username} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white">
                <Link
                  href={`/players/${f.user.username}`}
                  className="font-semibold hover:text-hot-300"
                >
                  @{f.user.username}
                </Link>{' '}
                <span className="text-white/60">favorited</span>{' '}
                <span className="text-white">{f.facility.name}</span>
              </div>
              <div className="text-xs text-white/40 mt-1">
                {facilityMeta(f.facility)} ·{' '}
                {new Date(f.created_at).toLocaleDateString()}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
