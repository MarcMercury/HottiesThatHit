'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

interface Partner {
  partner_id: string;
  sessions_together: number;
  last_played_at: string | null;
  partner: {
    id: string;
    username: string;
    ntrp_rating: number | null;
    image_url_1: string | null;
    city: string | null;
  } | null;
}

export function PlayerSocial({ username }: { username: string }) {
  const supabase = getBrowserClient();
  const { user, profile } = useAuth();
  const isSelf = profile?.username?.toLowerCase() === username.toLowerCase();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<{ follower_count: number; following_count: number }>({
    follower_count: 0,
    following_count: 0,
  });
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [busy, setBusy] = useState(false);

  const authedFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers = new Headers(init?.headers);
      if (token) headers.set('authorization', `Bearer ${token}`);
      headers.set('content-type', 'application/json');
      return fetch(input, { ...init, headers, cache: 'no-store' });
    },
    [supabase],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [fRes, pRes] = await Promise.all([
        authedFetch(`/api/social/follow?username=${username}`),
        authedFetch(`/api/social/partners?username=${username}`),
      ]);
      if (!alive) return;
      if (fRes.ok) {
        const j = await fRes.json();
        setFollowing(j.following);
        setCounts({ follower_count: j.follower_count, following_count: j.following_count });
      }
      if (pRes.ok) {
        const j = await pRes.json();
        setPartners(j.partners);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authedFetch, username]);

  async function toggleFollow() {
    if (!user) return;
    setBusy(true);
    const res = await authedFetch(
      following
        ? `/api/social/follow?username=${username}`
        : `/api/social/follow`,
      {
        method: following ? 'DELETE' : 'POST',
        body: following ? undefined : JSON.stringify({ username }),
      },
    );
    setBusy(false);
    if (res.ok) {
      setFollowing((f) => !f);
      setCounts((c) => ({
        ...c,
        follower_count: c.follower_count + (following ? -1 : 1),
      }));
    }
  }

  return (
    <section className="card mt-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-white/70 text-sm">
          <strong className="text-white">{counts.follower_count}</strong> follower
          {counts.follower_count === 1 ? '' : 's'} ·{' '}
          <strong className="text-white">{counts.following_count}</strong> following
        </div>
        {!isSelf && user && following !== null && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={busy}
            className={
              following
                ? 'rounded-full px-4 py-1.5 text-sm border border-ink-line text-white/80 hover:border-red-500/60 hover:text-red-200 disabled:opacity-50'
                : 'btn-primary text-sm disabled:opacity-50'
            }
          >
            {following ? 'Unfollow' : 'Follow'}
          </button>
        )}
        {!isSelf && !user && (
          <Link href="/login" className="btn-primary text-sm">
            Sign in to follow
          </Link>
        )}
      </div>

      <h2 className="text-white font-semibold mt-6">Hitting partners</h2>
      <p className="text-white/50 text-xs mt-1">
        Players who&apos;ve shared past Open Play sessions with @{username}.
      </p>
      {partners === null ? (
        <p className="text-white/50 text-sm mt-3">Loading…</p>
      ) : partners.length === 0 ? (
        <p className="text-white/50 text-sm mt-3">No shared sessions yet.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {partners.map((p) => {
            if (!p.partner) return null;
            return (
              <li
                key={p.partner_id}
                className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft/60 p-3"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full border border-ink-line bg-ink-soft shrink-0">
                  {p.partner.image_url_1 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.partner.image_url_1}
                      alt={p.partner.username}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/players/${p.partner.username}`}
                    className="text-white font-semibold hover:text-hot-300 truncate block"
                  >
                    @{p.partner.username}
                  </Link>
                  <div className="text-xs text-white/50">
                    {p.sessions_together} session{p.sessions_together === 1 ? '' : 's'}
                    {p.partner.ntrp_rating != null &&
                      ` · NTRP ${Number(p.partner.ntrp_rating).toFixed(1)}`}
                    {p.partner.city ? ` · ${p.partner.city}` : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
