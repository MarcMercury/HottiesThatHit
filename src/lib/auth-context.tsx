'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase-browser';

export interface Profile {
  id: string;
  username: string;
  email: string;
  ntrp_rating: number | null;
  bio: string | null;
  city: string | null;
  image_url_1: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  is_admin: boolean;
}

interface AuthContextValue {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (uid: string | undefined) => {
      if (!uid) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    // Failsafe: if anything below hangs (corrupted localStorage, network),
    // never leave the UI stuck on "Loading…".
    const failsafe = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        try {
          await loadProfile(data.session?.user.id);
        } catch {
          /* profile load failure must not block the UI */
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] getSession failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      // IMPORTANT: do NOT await Supabase calls inside this callback.
      // supabase-js holds its auth lock while invoking listeners; any
      // awaited supabase.* call here will deadlock (e.g. signInWithPassword
      // never resolves and the login button hangs on "Signing in…").
      setSession(sess);
      setLoading(false);
      setTimeout(() => {
        loadProfile(sess?.user.id).catch(() => {
          /* swallow */
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const value: AuthContextValue = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
