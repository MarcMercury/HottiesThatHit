'use client';

// Reusable favorite-court card grid used on the user's own /profile page.
// Loads the signed-in user's favorites (joined with facility metadata) via the
// browser Supabase client and offers an instant unfavorite button per card.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';
import { useFavorites } from '@/lib/favorites';

interface FavRow {
  facility_id: string;
  created_at: string;
  facilities: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    region: string | null;
    metro: string | null;
    num_courts: number | null;
    category: string | null;
    online_booking: boolean | null;
    facility_booking_url: string | null;
  } | null;
}

export function MyFavoritesList() {
  const { user } = useAuth();
  const supabase = getBrowserClient();
  const { favorites, toggle } = useFavorites();
  const [rows, setRows] = useState<FavRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial + on-change reload. Cheap query — favorites lists are tiny.
  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('favorites')
        .select(
          'facility_id, created_at, facilities ( id, name, address, city, region, metro, num_courts, category, online_booking, facility_booking_url )',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[favorites] load failed', error);
        setRows([]);
      } else {
        setRows((data as unknown as FavRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Reload whenever the favorite set size changes (add/remove) so newly
    // saved courts appear instantly without manual refetch wiring.
  }, [user, supabase, favorites.size]);

  if (loading) {
    return <p className="text-white/50 text-sm">Loading favorites…</p>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-line bg-ink-soft/40 p-6 text-center">
        <p className="text-white/70 text-sm">No favorite courts yet.</p>
        <p className="text-white/50 text-xs mt-1">
          Tap the heart on any court in{' '}
          <Link href="/courts" className="text-hot-300 hover:text-hot-200">
            Find a Court
          </Link>{' '}
          to save it here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => {
        const f = row.facilities;
        if (!f) return null;
        const meta = [
          f.num_courts ? `${f.num_courts} courts` : null,
          f.city,
          f.region,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li
            key={row.facility_id}
            className="relative rounded-xl border border-ink-line bg-ink-soft/60 p-4 hover:border-hot-500/60 transition"
          >
            <button
              type="button"
              onClick={() => toggle(f.id)}
              aria-label="Remove from favorites"
              title="Remove from favorites"
              className="absolute top-2 right-2 text-hot-400 hover:text-hot-300 p-1"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <p className="text-white font-semibold pr-8">{f.name}</p>
            {meta && <p className="text-white/50 text-xs mt-1">{meta}</p>}
            {f.address && (
              <p className="text-white/40 text-xs mt-0.5">{f.address}</p>
            )}
            <div className="mt-3 flex gap-3 text-xs">
              <Link
                href={`/courts?facility=${f.id}`}
                className="text-hot-300 hover:text-hot-200"
              >
                View on map →
              </Link>
              {f.online_booking && f.facility_booking_url && (
                <a
                  href={f.facility_booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-hot-300 hover:text-hot-200"
                >
                  Book ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
