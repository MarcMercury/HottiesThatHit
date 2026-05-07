'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase-browser';

// Uses useSearchParams — opt out of static prerender.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16 text-center text-white/60">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/profile';
  const supabase = getBrowserClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-4xl text-white text-center">Log in</h1>
      <p className="text-center text-white/60 text-sm mt-2">Welcome back, hottie.</p>

      <form onSubmit={onSubmit} className="card p-6 mt-8 space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Signing in…' : 'Log in'}
        </button>

        <p className="text-center text-sm text-white/60">
          No account?{' '}
          <Link href="/signup" className="text-hot-300 hover:text-hot-200">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink-line bg-ink px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-hot-500 focus:ring-2 focus:ring-hot-500/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-white/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
