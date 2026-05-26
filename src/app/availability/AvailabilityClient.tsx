'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

interface Ping {
  id: string;
  user_id: string;
  facility_id: string | null;
  starts_at: string;
  ends_at: string | null;
  message: string | null;
  user: { id: string; username: string; image_url_1: string | null } | null;
  facility: { id: string; name: string; city: string | null; region: string | null } | null;
}

interface FacilityLite {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
}

type Scope = 'feed' | 'all' | 'mine';

export function AvailabilityClient() {
  const supabase = getBrowserClient();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('feed');
  const [pings, setPings] = useState<Ping[] | null>(null);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const loadPings = useCallback(async () => {
    setPings(null);
    const res = await authedFetch(`/api/social/pings?scope=${scope}`);
    if (res.ok) {
      const j = (await res.json()) as { pings: Ping[] };
      setPings(j.pings);
    } else {
      setPings([]);
    }
  }, [authedFetch, scope]);

  useEffect(() => {
    loadPings();
  }, [loadPings]);

  useEffect(() => {
    // Load facilities for the picker (favorites first if signed in, otherwise a small slice).
    (async () => {
      const sb = getBrowserClient();
      let rows: FacilityLite[] = [];
      if (user) {
        const { data } = await sb
          .from('favorites')
          .select('facility_id, facilities ( id, name, city, region )')
          .eq('user_id', user.id)
          .limit(100);
        rows = ((data ?? []) as unknown as Array<{ facilities: FacilityLite | null }>)
          .map((r) => r.facilities)
          .filter((f): f is FacilityLite => !!f);
      }
      if (rows.length === 0) {
        const { data } = await sb
          .from('facilities')
          .select('id, name, city, region')
          .order('name')
          .limit(100);
        rows = (data ?? []) as FacilityLite[];
      }
      setFacilities(rows);
    })();
  }, [user]);

  async function submit() {
    setErr(null);
    if (!startsAt) {
      setErr('Pick a start time.');
      return;
    }
    setBusy(true);
    const res = await authedFetch('/api/social/pings', {
      method: 'POST',
      body: JSON.stringify({
        facility_id: facilityId || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        message: message.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Could not post');
      return;
    }
    setStartsAt('');
    setEndsAt('');
    setMessage('');
    setFacilityId('');
    await loadPings();
  }

  async function remove(id: string) {
    if (!confirm('Delete this ping?')) return;
    const res = await authedFetch(`/api/social/pings?id=${id}`, { method: 'DELETE' });
    if (res.ok) await loadPings();
  }

  return (
    <div className="mt-6 space-y-6">
      {user ? (
        <section className="card p-6">
          <h2 className="text-white font-semibold">Post availability</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/60">
              Start
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
              />
            </label>
            <label className="text-xs text-white/60">
              End (optional)
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
              />
            </label>
            <label className="text-xs text-white/60 sm:col-span-2">
              Court (optional)
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="mt-1 w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
              >
                <option value="">— anywhere —</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.city ? ` — ${f.city}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/60 sm:col-span-2">
              Note (optional)
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Looking for 3.5+ singles…"
                className="mt-1 w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
              />
            </label>
          </div>
          {err && <p className="text-red-300 text-sm mt-3">{err}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !startsAt}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? 'Posting…' : "I'm free"}
            </button>
          </div>
        </section>
      ) : (
        <div className="card p-6 text-center">
          <p className="text-white/70">Sign in to post your availability.</p>
          <Link href="/login" className="btn-primary mt-4 inline-block">
            Sign in
          </Link>
        </div>
      )}

      <section>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-white font-semibold">Upcoming pings</h2>
          <div className="inline-flex rounded-full border border-ink-line bg-ink-soft/60 p-1 text-xs font-semibold">
            {(['feed', 'all', 'mine'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-3 py-1 rounded-full transition capitalize ${
                  scope === s ? 'bg-hot-500 text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                {s === 'feed' ? 'Following' : s === 'all' ? 'Everyone' : 'Mine'}
              </button>
            ))}
          </div>
        </div>

        {pings === null ? (
          <p className="text-white/60 text-sm mt-3">Loading…</p>
        ) : pings.length === 0 ? (
          <p className="text-white/60 text-sm mt-3">No upcoming pings.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pings.map((p) => (
              <li key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 overflow-hidden rounded-full border border-ink-line bg-ink-soft shrink-0">
                    {p.user?.image_url_1 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.user.image_url_1}
                        alt={p.user.username}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white">
                      {p.user && (
                        <Link
                          href={`/players/${p.user.username}`}
                          className="font-semibold hover:text-hot-300"
                        >
                          @{p.user.username}
                        </Link>
                      )}{' '}
                      <span className="text-white/60">
                        {new Date(p.starts_at).toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {p.ends_at &&
                          ` – ${new Date(p.ends_at).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`}
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
                      <p className="text-white/70 text-sm mt-1 whitespace-pre-wrap">
                        {p.message}
                      </p>
                    )}
                  </div>
                  {user && p.user_id === user.id && (
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
