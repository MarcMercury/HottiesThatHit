'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getBrowserClient } from '@/lib/supabase-browser';

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto max-w-md px-4 py-16 text-center text-white/60">Signing you in…</main>}
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState('Signing you in…');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;

    const run = async () => {
      // 1. Newer Supabase callback flow: ?code=...
      const code = search.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setMsg('Sign-in failed.');
          setErr(error.message);
          return;
        }
      }

      // 2. Hash-fragment flow (e.g. recovery) — supabase-js auto-detects via
      //    detectSessionInUrl. Just wait for it.
      await supabase.auth.getSession();

      // 3. If this is a recovery flow, prompt for a new password.
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const isRecovery =
        search.get('type') === 'recovery' || hash.includes('type=recovery');
      if (isRecovery) {
        setMsg('Set a new password');
        setNeedsPassword(true);
        return;
      }

      // 4. Otherwise just bounce to /profile.
      router.replace('/profile');
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router, search]);

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw1.length < 8) return setErr('Password must be at least 8 characters.');
    if (pw1 !== pw2) return setErr('Passwords do not match.');
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) return setErr(error.message);
    router.replace('/profile');
  };

  if (needsPassword) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-3xl text-white text-center">Set a new password</h1>
        <form onSubmit={submitNewPassword} className="card p-6 mt-6 space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink px-4 py-2.5 text-sm text-white"
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-lg border border-ink-line bg-ink px-4 py-2.5 text-sm text-white"
          />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button type="submit" className="btn-primary w-full">Save password</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center text-white/70">
      <p>{msg}</p>
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </main>
  );
}
