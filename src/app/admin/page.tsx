'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  ntrp_rating: number | null;
  city: string | null;
  is_admin: boolean;
  image_url_1: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const supabase = getBrowserClient();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    setRefreshing(true);
    try {
      const res = await authedFetch(`/api/admin/users?t=${Date.now()}`);
      if (!res.ok) {
        setErr((await res.json().catch(() => ({}))).error ?? 'Failed to load users');
        setUsers([]);
        return;
      }
      const json = (await res.json()) as { users: AdminUser[] };
      setUsers(json.users);
    } finally {
      setRefreshing(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?next=/admin');
      return;
    }
    if (profile && !profile.is_admin) {
      setErr('You are not an admin.');
      setUsers([]);
      return;
    }
    if (profile?.is_admin) load();
  }, [loading, user, profile, router, load]);

  const toggleAdmin = async (u: AdminUser) => {
    setBusyId(u.id);
    const res = await authedFetch('/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ id: u.id, is_admin: !u.is_admin }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Update failed');
      return;
    }
    await load();
  };

  const setRating = async (u: AdminUser, value: string) => {
    const ntrp = value === '' ? null : Number(value);
    setBusyId(u.id);
    const res = await authedFetch('/api/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ id: u.id, ntrp_rating: ntrp }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Update failed');
      return;
    }
    await load();
  };

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`Delete @${u.username}? This cannot be undone.`)) return;
    setBusyId(u.id);
    const res = await authedFetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      return;
    }
    await load();
  };

  const resetPassword = async (u: AdminUser) => {
    if (!confirm(`Send a password reset link to ${u.email}?`)) return;
    setBusyId(u.id);
    setNotice(null);
    setErr(null);
    const res = await authedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset_password', id: u.id }),
    });
    setBusyId(null);
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      action_link?: string | null;
      email?: string;
    };
    if (!res.ok) {
      setErr(json.error ?? 'Password reset failed');
      return;
    }
    if (json.action_link) {
      try {
        await navigator.clipboard.writeText(json.action_link);
        setNotice(
          `Reset link for ${json.email} copied to clipboard (also emailed if SMTP is configured).`,
        );
      } catch {
        setNotice(`Reset link generated for ${json.email}: ${json.action_link}`);
      }
    } else {
      setNotice(`Password reset email sent to ${json.email}.`);
    }
  };

  if (loading || users === null) {
    return <main className="mx-auto max-w-5xl px-4 py-12 text-white/60">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl text-white">Admin</h1>
          <p className="text-white/60 text-sm mt-1">
            {users.length} user{users.length === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={load} disabled={refreshing} className="btn-ghost disabled:opacity-50">
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {err && (
        <div className="card mt-6 border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {notice && (
        <div className="card mt-6 border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100 break-all">
          {notice}
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">NTRP</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 overflow-hidden rounded-full border border-ink-line bg-ink-soft">
                      {u.image_url_1 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.image_url_1}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <Link
                      href={`/players/${u.username}`}
                      className="text-white hover:text-hot-300"
                    >
                      @{u.username}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/70">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.ntrp_rating != null ? Number(u.ntrp_rating).toFixed(1) : ''}
                    onChange={(e) => setRating(u, e.target.value)}
                    disabled={busyId === u.id}
                    className="rounded-md border border-ink-line bg-ink px-2 py-1 text-xs text-white"
                  >
                    <option value="">—</option>
                    {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map(
                      (n) => (
                        <option key={n} value={n.toFixed(1)}>
                          {n.toFixed(1)}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleAdmin(u)}
                    disabled={busyId === u.id || u.id === user?.id}
                    title={u.id === user?.id ? "Can't change your own admin flag" : ''}
                    className={`rounded-full px-3 py-1 text-xs ${
                      u.is_admin
                        ? 'bg-hot-500/20 text-hot-200 border border-hot-500/40'
                        : 'border border-ink-line text-white/60'
                    } disabled:opacity-50`}
                  >
                    {u.is_admin ? 'Admin' : 'User'}
                  </button>
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleString()
                    : 'never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => resetPassword(u)}
                      disabled={busyId === u.id || !u.email}
                      className="text-xs text-hot-300 hover:text-hot-200 disabled:opacity-30"
                    >
                      reset password
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={busyId === u.id || u.id === user?.id}
                      className="text-xs text-red-300 hover:text-red-200 disabled:opacity-30"
                    >
                      delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
