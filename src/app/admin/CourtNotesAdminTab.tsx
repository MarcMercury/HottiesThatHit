'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';

interface PendingNote {
  id: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  facility: { id: string; name: string; city: string | null; region: string | null } | null;
  author: { id: string; username: string } | null;
}

type StatusTab = 'pending' | 'approved' | 'rejected';

export function CourtNotesAdminTab() {
  const supabase = getBrowserClient();
  const [status, setStatus] = useState<StatusTab>('pending');
  const [notes, setNotes] = useState<PendingNote[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setErr(null);
    setNotes(null);
    const res = await authedFetch(`/api/admin/court-notes?status=${status}`);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Failed to load notes');
      setNotes([]);
      return;
    }
    const json = (await res.json()) as { notes: PendingNote[] };
    setNotes(json.notes);
    setDrafts(Object.fromEntries(json.notes.map((n) => [n.id, n.body])));
  }, [authedFetch, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, fields: { body?: string; status?: StatusTab }) {
    setBusyId(id);
    const res = await authedFetch('/api/admin/court-notes', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...fields }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Update failed');
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this note permanently?')) return;
    setBusyId(id);
    const res = await authedFetch(`/api/admin/court-notes?id=${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      return;
    }
    await load();
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="inline-flex rounded-full border border-ink-line bg-ink-soft/60 p-1 text-xs font-semibold">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full transition capitalize ${
              status === s ? 'bg-hot-500 text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {err && (
        <div className="card border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>
      )}

      {notes === null ? (
        <p className="text-white/60 text-sm">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="card p-8 text-center text-white/60 text-sm">No {status} notes.</div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold">
                    {n.facility ? (
                      <Link
                        href={`/courts?facility=${n.facility.id}`}
                        className="hover:text-hot-300"
                      >
                        {n.facility.name}
                      </Link>
                    ) : (
                      <span className="text-white/60">Facility deleted</span>
                    )}
                  </div>
                  <div className="text-xs text-white/50">
                    {[n.facility?.region, n.facility?.city].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-[11px] text-white/40 mt-1">
                    submitted{' '}
                    {new Date(n.created_at).toLocaleString()}{' '}
                    {n.author && (
                      <>
                        by{' '}
                        <Link
                          href={`/players/${n.author.username}`}
                          className="text-white/60 hover:text-hot-300"
                        >
                          @{n.author.username}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={`chip text-[10px] ${
                    n.status === 'approved'
                      ? 'border-emerald-500/40 text-emerald-200'
                      : n.status === 'rejected'
                        ? 'border-red-500/40 text-red-200'
                        : 'border-amber-500/40 text-amber-200'
                  }`}
                >
                  {n.status}
                </span>
              </div>

              <textarea
                value={drafts[n.id] ?? n.body}
                onChange={(e) => setDrafts((d) => ({ ...d, [n.id]: e.target.value }))}
                rows={3}
                maxLength={1000}
                className="mt-3 w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(drafts[n.id] ?? n.body) !== n.body && (
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => patch(n.id, { body: drafts[n.id] })}
                    className="btn-ghost text-xs"
                  >
                    Save edits
                  </button>
                )}
                {status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() =>
                      patch(n.id, {
                        body: drafts[n.id] !== n.body ? drafts[n.id] : undefined,
                        status: 'approved',
                      })
                    }
                    className="btn-primary text-xs"
                  >
                    Approve
                  </button>
                )}
                {status !== 'rejected' && (
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => patch(n.id, { status: 'rejected' })}
                    className="rounded-full px-3 py-1.5 text-xs border border-ink-line text-white/70 hover:text-white hover:border-red-500/60"
                  >
                    Reject
                  </button>
                )}
                {status === 'rejected' && (
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => patch(n.id, { status: 'pending' })}
                    className="rounded-full px-3 py-1.5 text-xs border border-ink-line text-white/70 hover:text-white"
                  >
                    Move back to pending
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === n.id}
                  onClick={() => remove(n.id)}
                  className="ml-auto text-xs text-red-300 hover:text-red-200 disabled:opacity-30"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
