'use client';

// Client-side hook + helpers for per-user favorite courts.
// - Loads the signed-in user's favorites once, then keeps a local Set in state.
// - Optimistic toggle so the heart icon reacts instantly; rolls back on error.
// - Broadcasts changes via a window event so any other component on the page
//   (map popup, profile list) stays in sync without a global store.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';

const EVENT = 'hth:favorites-changed';

export interface UseFavorites {
  ready: boolean;
  signedIn: boolean;
  favorites: Set<string>;
  isFavorite: (facilityId: string) => boolean;
  toggle: (facilityId: string) => Promise<boolean>;
}

export function useFavorites(): UseFavorites {
  const { user, loading } = useAuth();
  const supabase = getBrowserClient();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // Load favorites for the current user (or clear on logout).
  useEffect(() => {
    let cancelled = false;
    userIdRef.current = user?.id ?? null;
    if (loading) return;
    if (!user) {
      setFavorites(new Set());
      setReady(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('favorites')
        .select('facility_id')
        .eq('user_id', user.id);
      if (cancelled) return;
      setFavorites(new Set((data ?? []).map((r) => r.facility_id as string)));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, supabase]);

  // Cross-component sync: listen for toggles fired from elsewhere on the page.
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ facilityId: string; isFav: boolean; userId: string }>).detail;
      if (!detail) return;
      if (detail.userId !== userIdRef.current) return;
      setFavorites((prev) => {
        const next = new Set(prev);
        if (detail.isFav) next.add(detail.facilityId);
        else next.delete(detail.facilityId);
        return next;
      });
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const toggle = useCallback(
    async (facilityId: string): Promise<boolean> => {
      if (!user) {
        // Send unauth users to login and preserve their intent loosely.
        window.location.href = '/login?next=/courts';
        return false;
      }
      const wasFav = favorites.has(facilityId);
      const nextFav = !wasFav;

      // Optimistic local update + broadcast.
      setFavorites((prev) => {
        const next = new Set(prev);
        if (nextFav) next.add(facilityId);
        else next.delete(facilityId);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent(EVENT, {
          detail: { facilityId, isFav: nextFav, userId: user.id },
        }),
      );

      const { error } = nextFav
        ? await supabase
            .from('favorites')
            .insert({ user_id: user.id, facility_id: facilityId })
        : await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('facility_id', facilityId);

      if (error) {
        // Roll back.
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(facilityId);
          else next.delete(facilityId);
          return next;
        });
        window.dispatchEvent(
          new CustomEvent(EVENT, {
            detail: { facilityId, isFav: wasFav, userId: user.id },
          }),
        );
        // eslint-disable-next-line no-console
        console.error('[favorites] toggle failed', error);
        return wasFav;
      }
      return nextFav;
    },
    [favorites, supabase, user],
  );

  return {
    ready,
    signedIn: !!user,
    favorites,
    isFavorite: (id) => favorites.has(id),
    toggle,
  };
}
