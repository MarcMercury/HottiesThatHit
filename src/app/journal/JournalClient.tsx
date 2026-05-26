'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

// --- types -------------------------------------------------------------------

interface WeatherSnapshot {
  date: string;
  highF: number;
  lowF: number;
  precipPct: number;
  label: string;
  emoji: string;
}

interface Participant {
  user_id: string;
  is_host: boolean;
  user: { id: string; username: string; image_url_1: string | null; ntrp_rating: number | null } | null;
}

interface JournalEntry {
  id: string;
  event_id: string | null;
  facility_id: string | null;
  played_at: string;
  won: boolean | null;
  how_i_played: string | null;
  opponents_played: string | null;
  strongest_shot: string | null;
  work_on: string | null;
  notes: string | null;
  weather: WeatherSnapshot | null;
  facility: { id: string; name: string; city: string | null; region: string | null } | null;
  event: {
    id: string;
    start_time: string;
    end_time: string;
    court_number: string | null;
    title: string | null;
    participants: Participant[];
  } | null;
}

// --- vocab -------------------------------------------------------------------

const HOW_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'great', label: 'Crushed it' },
  { value: 'good', label: 'Solid' },
  { value: 'ok', label: 'OK' },
  { value: 'off', label: 'Off day' },
];

const SHOT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'forehand', label: 'Forehand' },
  { value: 'backhand', label: 'Backhand' },
  { value: 'serve', label: 'Serve' },
  { value: 'return', label: 'Return' },
  { value: 'volley', label: 'Volley' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'slice', label: 'Slice' },
  { value: 'dropshot', label: 'Drop shot' },
  { value: 'movement', label: 'Movement / footwork' },
  { value: 'mental', label: 'Mental / focus' },
];

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- main --------------------------------------------------------------------

export function JournalClient() {
  const { user, loading } = useAuth();
  const supabase = getBrowserClient();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setEntries([]);
      return;
    }
    const res = await fetch('/api/journal', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Failed to load journal');
      setEntries([]);
      return;
    }
    const json = (await res.json()) as { entries: JournalEntry[] };
    setEntries(json.entries);
  }, [supabase]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setEntries([]);
      return;
    }
    load();
  }, [loading, user, load]);

  const stats = useMemo(() => {
    if (!entries) return null;
    const played = entries.length;
    const wins = entries.filter((e) => e.won === true).length;
    const losses = entries.filter((e) => e.won === false).length;
    return { played, wins, losses };
  }, [entries]);

  if (loading || entries === null) {
    return <p className="text-white/60">Loading…</p>;
  }
  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="text-white/80">
          <Link href="/login?next=/journal" className="text-hot-300 hover:text-hot-200">
            Sign in
          </Link>{' '}
          to start logging your matches.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && stats.played > 0 && (
        <div className="card flex flex-wrap items-center gap-6 p-4">
          <Stat label="Matches" value={stats.played} />
          <Stat label="Wins" value={stats.wins} />
          <Stat label="Losses" value={stats.losses} />
        </div>
      )}

      {error && (
        <div className="card border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {entries.length === 0 && (
        <div className="card p-8 text-center text-white/70">
          <p>No matches yet. Join or host an{' '}
            <Link href="/open-play" className="text-hot-300 hover:text-hot-200">
              Open Play
            </Link>{' '}
            game and your journal entry will show up here once it&apos;s done.
          </p>
        </div>
      )}

      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} userId={user.id} onSaved={load} />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-display text-white">{value}</div>
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}

// --- entry card --------------------------------------------------------------

function EntryCard({
  entry,
  userId,
  onSaved,
}: {
  entry: JournalEntry;
  userId: string;
  onSaved: () => void;
}) {
  const supabase = getBrowserClient();
  const [draft, setDraft] = useState({
    won: entry.won,
    how_i_played: entry.how_i_played ?? '',
    opponents_played: entry.opponents_played ?? '',
    strongest_shot: entry.strongest_shot ?? '',
    work_on: entry.work_on ?? '',
    notes: entry.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const opponents = (entry.event?.participants ?? []).filter(
    (p) => p.user_id !== userId && p.user,
  );

  async function patch(fields: Partial<typeof draft>) {
    setSaving(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const payload: Record<string, unknown> = { id: entry.id };
    for (const [k, v] of Object.entries(fields)) {
      payload[k] = v === '' ? null : v;
    }
    const res = await fetch('/api/journal', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(Date.now());
      onSaved();
    }
  }

  async function remove() {
    if (!confirm('Delete this journal entry?')) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    await fetch(`/api/journal?id=${entry.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    onSaved();
  }

  const w = entry.weather;
  return (
    <article className="card p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50">
            {fmtWhen(entry.played_at)}
          </div>
          <div className="mt-1 text-white font-semibold">
            {entry.facility ? entry.facility.name : 'Free-form entry'}
            {entry.event?.court_number && (
              <span className="text-white/50 font-normal"> · Court {entry.event.court_number}</span>
            )}
          </div>
          {(entry.facility?.region || entry.facility?.city) && (
            <div className="text-xs text-white/50">
              {entry.facility?.region ?? entry.facility?.city}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {w && (
            <span className="chip">
              {w.emoji} {w.highF}°/{w.lowF}° · {w.label}
            </span>
          )}
          <button
            type="button"
            onClick={remove}
            className="text-white/40 hover:text-red-300"
            title="Delete entry"
          >
            ✕
          </button>
        </div>
      </header>

      {opponents.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Played with</p>
          <div className="flex flex-wrap gap-2">
            {opponents.map((p) => (
              <Link
                key={p.user_id}
                href={`/players/${p.user!.username}`}
                className="chip hover:bg-hot-500/20 hover:border-hot-500/40"
              >
                @{p.user!.username}
                {p.user!.ntrp_rating != null && (
                  <span className="ml-1 text-white/50 text-[10px]">
                    {Number(p.user!.ntrp_rating).toFixed(1)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <DropField
          label="Win or Loss?"
          value={draft.won === null ? '' : draft.won ? 'win' : 'loss'}
          options={[
            { value: '', label: '—' },
            { value: 'win', label: 'Win' },
            { value: 'loss', label: 'Loss' },
          ]}
          onChange={(v) => {
            const won = v === '' ? null : v === 'win';
            setDraft((d) => ({ ...d, won }));
            patch({ won } as unknown as Partial<typeof draft>);
          }}
        />
        <DropField
          label="How did I play?"
          value={draft.how_i_played}
          options={[{ value: '', label: '—' }, ...HOW_OPTIONS]}
          onChange={(v) => {
            setDraft((d) => ({ ...d, how_i_played: v }));
            patch({ how_i_played: v });
          }}
        />
        <DropField
          label="How did opponents play?"
          value={draft.opponents_played}
          options={[{ value: '', label: '—' }, ...HOW_OPTIONS]}
          onChange={(v) => {
            setDraft((d) => ({ ...d, opponents_played: v }));
            patch({ opponents_played: v });
          }}
        />
        <DropField
          label="Strongest shot of the day"
          value={draft.strongest_shot}
          options={[{ value: '', label: '—' }, ...SHOT_OPTIONS]}
          onChange={(v) => {
            setDraft((d) => ({ ...d, strongest_shot: v }));
            patch({ strongest_shot: v });
          }}
        />
        <DropField
          label="What to work on"
          value={draft.work_on}
          options={[{ value: '', label: '—' }, ...SHOT_OPTIONS]}
          onChange={(v) => {
            setDraft((d) => ({ ...d, work_on: v }));
            patch({ work_on: v });
          }}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">
          Notes
        </label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          onBlur={() => patch({ notes: draft.notes })}
          rows={3}
          placeholder="Anything to remember — score, conditions, lessons learned…"
          className="w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
        />
      </div>

      <div className="text-[11px] text-white/40 text-right h-3">
        {saving ? 'Saving…' : savedAt ? 'Saved ✓' : ''}
      </div>
    </article>
  );
}

function DropField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/50 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
