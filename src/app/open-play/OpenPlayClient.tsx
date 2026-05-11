'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

// ---------- types ----------

interface ProfileLite {
  id: string;
  username: string;
  ntrp_rating: number | null;
  image_url_1: string | null;
}

interface FacilityLite {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
}

interface ParticipantRow {
  user_id: string;
  joined_at: string;
  is_host: boolean;
  user: ProfileLite | null;
}

export interface OpenPlayEvent {
  id: string;
  host_id: string;
  facility_id: string;
  court_number: string | null;
  start_time: string;
  end_time: string;
  total_spots: number;
  min_ntrp: number | null;
  max_ntrp: number | null;
  title: string | null;
  notes: string | null;
  court_reserved: boolean;
  status: 'open' | 'full' | 'cancelled' | 'completed';
  created_at: string;
  host: ProfileLite | null;
  facility: FacilityLite | null;
  participants: ParticipantRow[];
}

export interface FacilityOption {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  num_courts: number | null;
}

// ---------- helpers ----------

const NTRP_OPTIONS = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0,
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
function fmtRange(start: string, end: string) {
  return `${fmtDate(start)} · ${fmtTime(start)} – ${fmtTime(end)}`;
}

function levelLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return 'All levels';
  if (min != null && max != null) {
    if (min === max) return `NTRP ${min.toFixed(1)}`;
    return `NTRP ${min.toFixed(1)}–${max.toFixed(1)}`;
  }
  if (min != null) return `NTRP ${min.toFixed(1)}+`;
  return `NTRP ≤ ${max!.toFixed(1)}`;
}

// Build a default local-datetime string for <input type="datetime-local">.
function defaultDateTimeLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addHoursLocal(local: string, hours: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Build a Google Calendar "render" URL — works in any browser, no OAuth.
// https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...
function googleCalendarUrl(ev: OpenPlayEvent): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dates = `${fmt(ev.start_time)}/${fmt(ev.end_time)}`;

  const title = ev.title?.trim() || 'Open Play (Tennis)';
  const locationParts = [
    ev.facility?.name,
    ev.facility?.address,
    ev.facility?.city,
  ].filter(Boolean);
  const location = locationParts.join(', ');

  const detailLines = [
    `Hosted by @${ev.host?.username ?? 'unknown'} on Hotties That Hit`,
    `Level: ${levelLabel(ev.min_ntrp, ev.max_ntrp)}`,
    `Spots: ${ev.total_spots} total`,
    ev.court_number ? `Court: ${ev.court_number}` : null,
    ev.court_reserved ? 'Court is reserved' : 'Court NOT reserved — show up & wait',
    ev.notes ? `\n${ev.notes}` : null,
    `\nhttps://www.slapp.fun/open-play`,
  ].filter(Boolean);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details: detailLines.join('\n'),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ---------- main component ----------

export function OpenPlayClient({
  initialEvents,
  facilities,
}: {
  initialEvents: OpenPlayEvent[];
  facilities: FacilityOption[];
}) {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<OpenPlayEvent[]>(initialEvents);
  const [showCreate, setShowCreate] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<'upcoming' | 'mine'>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.facility?.region) set.add(e.facility.region);
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let list = events;
    if (filterScope === 'mine' && user) {
      list = list.filter(
        (e) =>
          e.host_id === user.id ||
          e.participants.some((p) => p.user_id === user.id),
      );
    }
    if (filterRegion !== 'all') {
      list = list.filter((e) => e.facility?.region === filterRegion);
    }
    return list;
  }, [events, filterScope, filterRegion, user]);

  async function refresh() {
    const token = (await getBrowserClient().auth.getSession()).data.session
      ?.access_token;
    const res = await fetch('/api/open-play?scope=upcoming', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      setEvents(json.events ?? []);
    }
  }

  async function authedFetch(input: string, init: RequestInit = {}) {
    const token = (await getBrowserClient().auth.getSession()).data.session
      ?.access_token;
    return fetch(input, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  async function onJoin(ev: OpenPlayEvent) {
    setErrorMsg(null);
    setBusyId(ev.id);
    try {
      const res = await authedFetch(`/api/open-play/${ev.id}/join`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.error || 'Could not join');
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onLeave(ev: OpenPlayEvent) {
    setErrorMsg(null);
    setBusyId(ev.id);
    try {
      const res = await authedFetch(`/api/open-play/${ev.id}/join`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.error || 'Could not leave');
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(ev: OpenPlayEvent) {
    if (!confirm('Cancel this match? Everyone who joined will lose their spot.'))
      return;
    setErrorMsg(null);
    setBusyId(ev.id);
    try {
      const res = await authedFetch(`/api/open-play/${ev.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.error || 'Could not cancel');
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value as 'upcoming' | 'mine')}
            className="bg-ink-soft border border-ink-line rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="upcoming">All upcoming</option>
            <option value="mine" disabled={!user}>
              My matches
            </option>
          </select>
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="bg-ink-soft border border-ink-line rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {user ? (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Set Up a Match
          </button>
        ) : (
          <Link href="/login?next=/open-play" className="btn-primary">
            Log in to post
          </Link>
        )}
      </div>

      {errorMsg && (
        <div className="card border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-white/60">
          <p className="text-white">No matches{filterScope === 'mine' ? ' you\u2019re in' : ''} yet.</p>
          {user ? (
            <p className="mt-2 text-sm">
              Be the first —{' '}
              <button
                onClick={() => setShowCreate(true)}
                className="text-hot-300 hover:text-hot-200 underline"
              >
                set up a match
              </button>
              .
            </p>
          ) : (
            <p className="mt-2 text-sm">
              <Link href="/signup" className="text-hot-300 hover:text-hot-200">
                Sign up
              </Link>{' '}
              to post or join one.
            </p>
          )}
        </div>
      ) : (
        <ul className="grid gap-4">
          {filtered.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              currentUserId={user?.id ?? null}
              busy={busyId === ev.id}
              onJoin={() => onJoin(ev)}
              onLeave={() => onLeave(ev)}
              onCancel={() => onCancel(ev)}
            />
          ))}
        </ul>
      )}

      {/* Create modal */}
      {showCreate && user && (
        <CreateMatchModal
          facilities={facilities}
          hostNtrp={profile?.ntrp_rating ?? null}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------- event card ----------

function EventCard({
  ev,
  currentUserId,
  busy,
  onJoin,
  onLeave,
  onCancel,
}: {
  ev: OpenPlayEvent;
  currentUserId: string | null;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const isHost = currentUserId && currentUserId === ev.host_id;
  const isJoined = !!currentUserId && ev.participants.some((p) => p.user_id === currentUserId);
  const claimed = ev.participants.length;
  const open = Math.max(ev.total_spots - claimed, 0);
  const full = open === 0;
  const ended = new Date(ev.end_time).getTime() < Date.now();

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {ev.title || 'Open Play'}
            </h3>
            <span className="chip">{levelLabel(ev.min_ntrp, ev.max_ntrp)}</span>
            {full ? (
              <span className="chip border-white/30 bg-white/10 text-white/80">
                Full
              </span>
            ) : (
              <span className="chip border-court-ball/40 bg-court-ball/10 text-court-ball">
                {open} spot{open === 1 ? '' : 's'} open
              </span>
            )}
            {ended && (
              <span className="chip border-white/20 bg-white/5 text-white/50">
                Ended
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-white/70">{fmtRange(ev.start_time, ev.end_time)}</p>
          <p className="mt-1 text-sm text-white/80">
            <span className="text-white">{ev.facility?.name ?? 'Unknown court'}</span>
            {ev.facility?.city && (
              <span className="text-white/50"> · {ev.facility.city}</span>
            )}
            {ev.court_number && (
              <span className="text-white/50"> · Court {ev.court_number}</span>
            )}
          </p>
          <p className="mt-1 text-xs">
            {ev.court_reserved ? (
              <span className="chip border-court-ball/40 bg-court-ball/10 text-court-ball">
                Court reserved
              </span>
            ) : (
              <span className="chip border-white/20 bg-white/5 text-white/60">
                Court not reserved
              </span>
            )}
          </p>
          {ev.notes && (
            <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">{ev.notes}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-white/50">
            Hosted by{' '}
            {ev.host ? (
              <Link
                href={`/players/${ev.host.username}`}
                className="text-hot-300 hover:text-hot-200"
              >
                @{ev.host.username}
              </Link>
            ) : (
              'unknown'
            )}
          </div>
          {!ended && (
            <div className="flex flex-wrap justify-end gap-2">
              <a
                href={googleCalendarUrl(ev)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs px-3 py-1.5"
                title="Open in Google Calendar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                </svg>
                Add to Calendar
              </a>
              {isHost ? (
                <button
                  onClick={onCancel}
                  disabled={busy}
                  className="btn-ghost text-xs px-3 py-1.5 border-red-500/40 text-red-200 hover:border-red-400"
                >
                  Cancel match
                </button>
              ) : isJoined ? (
                <button
                  onClick={onLeave}
                  disabled={busy}
                  className="btn-ghost text-xs px-3 py-1.5"
                >
                  Leave
                </button>
              ) : (
                <button
                  onClick={onJoin}
                  disabled={busy || full || !currentUserId}
                  className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  title={!currentUserId ? 'Log in to join' : full ? 'Event is full' : ''}
                >
                  {full ? 'Full' : 'Claim spot'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="mt-4 flex flex-wrap gap-2">
        {ev.participants
          .slice()
          .sort((a, b) => (a.is_host === b.is_host ? 0 : a.is_host ? -1 : 1))
          .map((p) => (
            <ParticipantChip key={p.user_id} p={p} />
          ))}
        {Array.from({ length: open }).map((_, i) => {
          const canClaim = !!currentUserId && !isHost && !isJoined && !ended;
          const title = !currentUserId
            ? 'Log in to claim a spot'
            : isHost
              ? "You're the host"
              : isJoined
                ? "You're already in"
                : ended
                  ? 'Event has ended'
                  : 'Claim this spot';
          return canClaim ? (
            <button
              key={`open-${i}`}
              type="button"
              onClick={onJoin}
              disabled={busy}
              title={title}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/30 px-2.5 py-1 text-xs text-white/60 transition hover:border-hot-400 hover:bg-hot-500/10 hover:text-hot-200 disabled:opacity-50"
            >
              {busy ? 'Joining…' : 'Open'}
            </button>
          ) : (
            <span
              key={`open-${i}`}
              title={title}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 px-2.5 py-1 text-xs text-white/40"
            >
              Open
            </span>
          );
        })}
      </div>
    </li>
  );
}

function ParticipantChip({ p }: { p: ParticipantRow }) {
  const u = p.user;
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-line bg-ink-soft/80 px-2 py-1 text-xs text-white/80">
      <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-ink-soft">
        {u?.image_url_1 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image_url_1} alt={u.username} className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="font-medium text-white">
        @{u?.username ?? 'unknown'}
      </span>
      {u?.ntrp_rating != null && (
        <span className="text-hot-300">{Number(u.ntrp_rating).toFixed(1)}</span>
      )}
      {p.is_host && <span className="text-white/40">· host</span>}
    </span>
  );
  return u ? (
    <Link href={`/players/${u.username}`} className="hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ---------- create modal ----------

function CreateMatchModal({
  facilities,
  hostNtrp,
  onClose,
  onCreated,
}: {
  facilities: FacilityOption[];
  hostNtrp: number | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [facilityQuery, setFacilityQuery] = useState('');
  const [facilityId, setFacilityId] = useState<string>('');
  const [courtNumber, setCourtNumber] = useState('');
  const [startLocal, setStartLocal] = useState<string>(defaultDateTimeLocal());
  const [endLocal, setEndLocal] = useState<string>(addHoursLocal(defaultDateTimeLocal(), 1.5));
  const [spots, setSpots] = useState(4);
  const [minNtrp, setMinNtrp] = useState<string>(
    hostNtrp != null ? String(Math.max(1, hostNtrp - 0.5)) : '',
  );
  const [maxNtrp, setMaxNtrp] = useState<string>(
    hostNtrp != null ? String(Math.min(7, hostNtrp + 0.5)) : '',
  );
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [courtReserved, setCourtReserved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keep end after start.
  useEffect(() => {
    if (!startLocal) return;
    if (!endLocal || new Date(endLocal) <= new Date(startLocal)) {
      setEndLocal(addHoursLocal(startLocal, 1.5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocal]);

  const filteredFacilities = useMemo(() => {
    const q = facilityQuery.trim().toLowerCase();
    if (!q) return facilities.slice(0, 50);
    return facilities
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.city ?? '').toLowerCase().includes(q) ||
          (f.region ?? '').toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [facilities, facilityQuery]);

  const selectedFacility = facilities.find((f) => f.id === facilityId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!facilityId) {
      setErr('Pick a court.');
      return;
    }
    const startISO = new Date(startLocal).toISOString();
    const endISO = new Date(endLocal).toISOString();
    if (new Date(endISO) <= new Date(startISO)) {
      setErr('End must be after start.');
      return;
    }

    const minN = minNtrp === '' ? null : Number(minNtrp);
    const maxN = maxNtrp === '' ? null : Number(maxNtrp);
    if (minN != null && maxN != null && maxN < minN) {
      setErr('Max level must be ≥ min level.');
      return;
    }

    setBusy(true);
    try {
      const token = (await getBrowserClient().auth.getSession()).data.session
        ?.access_token;
      const res = await fetch('/api/open-play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          facility_id: facilityId,
          court_number: courtNumber || null,
          start_time: startISO,
          end_time: endISO,
          total_spots: spots,
          min_ntrp: minN,
          max_ntrp: maxN,
          title: title || null,
          notes: notes || null,
          court_reserved: courtReserved,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || 'Could not create the match.');
        setBusy(false);
        return;
      }
      await onCreated();
    } catch (e: any) {
      setErr(e?.message || 'Network error.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card my-8 w-full max-w-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Set Up a Match</h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-white/60 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-5">
          {/* Court picker */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Where (court)
            </label>
            {selectedFacility ? (
              <div className="flex items-center justify-between rounded-md border border-hot-500/40 bg-hot-500/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-white">{selectedFacility.name}</p>
                  <p className="text-xs text-white/60 truncate">
                    {selectedFacility.city ?? 'LA'}
                    {selectedFacility.region ? ` · ${selectedFacility.region}` : ''}
                    {selectedFacility.num_courts
                      ? ` · ${selectedFacility.num_courts} courts`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFacilityId('')}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={facilityQuery}
                  onChange={(e) => setFacilityQuery(e.target.value)}
                  placeholder="Search by name, city, or region…"
                  className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
                />
                <ul className="mt-2 max-h-56 overflow-auto rounded-md border border-ink-line bg-ink-soft/60">
                  {filteredFacilities.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-white/50">No matches.</li>
                  ) : (
                    filteredFacilities.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setFacilityId(f.id)}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                        >
                          <span className="text-white">{f.name}</span>
                          <span className="text-white/50">
                            {' '}
                            · {f.city ?? 'LA'}
                            {f.region ? ` · ${f.region}` : ''}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>

          {/* Court number */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Court # (optional)
            </label>
            <input
              type="text"
              value={courtNumber}
              onChange={(e) => setCourtNumber(e.target.value)}
              placeholder="e.g. 3"
              maxLength={16}
              className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
          </div>

          {/* Court reserved? */}
          <div>
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={courtReserved}
                onChange={(e) => setCourtReserved(e.target.checked)}
                className="h-4 w-4 rounded border-ink-line bg-ink-soft text-hot-500 focus:ring-hot-500"
              />
              <span>
                Court reserved?{' '}
                <span className="text-white/50">
                  ({courtReserved ? 'Yes' : 'No'})
                </span>
              </span>
            </label>
          </div>

          {/* When */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
                Start
              </label>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                required
                className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
                End
              </label>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                required
                className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Spots */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Total spots (incl. you)
            </label>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSpots(n)}
                  className={`rounded-full px-3 py-1.5 text-sm border transition ${
                    spots === n
                      ? 'border-hot-500 bg-hot-500/20 text-white'
                      : 'border-ink-line text-white/70 hover:border-hot-500/60 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={2}
                max={16}
                value={spots}
                onChange={(e) =>
                  setSpots(
                    Math.max(2, Math.min(16, Number(e.target.value) || 2)),
                  )
                }
                className="w-20 bg-ink-soft/60 border border-ink-line rounded-md px-2 py-1.5 text-sm text-white"
              />
            </div>
          </div>

          {/* Level range */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Skill level (NTRP) — optional range
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={minNtrp}
                onChange={(e) => setMinNtrp(e.target.value)}
                className="bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white"
              >
                <option value="">Any min</option>
                {NTRP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n.toFixed(1)}
                  </option>
                ))}
              </select>
              <span className="text-white/40">to</span>
              <select
                value={maxNtrp}
                onChange={(e) => setMaxNtrp(e.target.value)}
                className="bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white"
              >
                <option value="">Any max</option>
                {NTRP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n.toFixed(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Doubles drill — needs 2"
              maxLength={120}
              className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Details (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Court reserved? Bringing balls? Skill expectations? Anything else."
              className="w-full bg-ink-soft/60 border border-ink-line rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <p className="mt-1 text-xs text-white/40">{notes.length}/1000</p>
          </div>

          {err && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Posting…' : 'Post match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
