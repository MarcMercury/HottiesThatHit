'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase-browser';

export default function SignupPage() {
  const router = useRouter();
  const supabase = getBrowserClient();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const validUsername = /^[a-z0-9_]{3,24}$/.test(username);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!validUsername) {
      setError('Username must be 3–24 chars, lowercase letters/numbers/underscore only.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);

    // Check username uniqueness up-front for a friendlier error.
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (existing) {
      setBusy(false);
      setError('That username is taken.');
      return;
    }

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (signUpErr) {
      setBusy(false);
      setError(signUpErr.message);
      return;
    }

    // If email confirmation is OFF, we'll have a session and can insert the profile now.
    // If email confirmation is ON, the profile will be created the first time they
    // hit /profile after confirming.
    const userId = data.user?.id;
    if (data.session && userId) {
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: userId,
        username,
        email,
      });
      if (insertErr) {
        setBusy(false);
        setError(insertErr.message);
        return;
      }
      setBusy(false);
      router.push('/profile');
      router.refresh();
      return;
    }

    setBusy(false);
    setInfo('Check your email to confirm your account, then log in.');
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-4xl text-white text-center">Sign up</h1>
      <p className="text-center text-white/60 text-sm mt-2">Hot pink courts only.</p>

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
        <Field label="Username">
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="lowercase, 3–24 chars"
            className={inputCls}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            className={inputCls}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-hot-300">{info}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-white/60">
          Have an account?{' '}
          <Link href="/login" className="text-hot-300 hover:text-hot-200">
            Log in
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
