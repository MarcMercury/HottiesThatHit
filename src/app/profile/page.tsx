'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getBrowserClient } from '@/lib/supabase-browser';
import { revalidatePlayers } from './actions';

const NTRP_OPTIONS = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0,
];
const NTRP_HINTS: Record<string, string> = {
  '1.0': 'New to tennis',
  '2.0': 'Beginner — learning strokes',
  '2.5': 'Beginner — short rallies',
  '3.0': 'Steady at slow pace',
  '3.5': 'Directional control, dependable strokes',
  '4.0': 'Reliable strokes, varied shots',
  '4.5': 'Strong play, anticipates well',
  '5.0': 'Tournament-level',
  '5.5': 'Sectional / regional level',
  '6.0': 'National / collegiate',
  '6.5': 'World-class amateur',
  '7.0': 'World-class / pro',
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const supabase = getBrowserClient();

  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [ntrp, setNtrp] = useState<string>('');
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/profile');
  }, [loading, user, router]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setCity(profile.city ?? '');
      setBio(profile.bio ?? '');
      setNtrp(profile.ntrp_rating != null ? String(profile.ntrp_rating) : '');
      setImages([
        profile.image_url_1 ?? null,
        profile.image_url_2 ?? null,
        profile.image_url_3 ?? null,
      ]);
    }
  }, [profile]);

  // Self-heal: if a confirmed user has no profile row yet, create one.
  useEffect(() => {
    const run = async () => {
      if (loading || !user || profile || creatingProfile) return;
      setCreatingProfile(true);
      const meta = (user.user_metadata ?? {}) as { username?: string };
      const fallbackUsername =
        meta.username ||
        `user_${user.id.slice(0, 8).replace(/-/g, '')}`;
      await supabase.from('profiles').insert({
        id: user.id,
        username: fallbackUsername,
        email: user.email ?? '',
      });
      await refreshProfile();
      setCreatingProfile(false);
    };
    run();
  }, [loading, user, profile, creatingProfile, supabase, refreshProfile]);

  if (loading || !user) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-white/60">Loading…</main>;
  }

  const onUpload = async (slot: 0 | 1 | 2, file: File) => {
    setBusy(true);
    setMsg(null);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/${slot + 1}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('hotties-profile-images')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setBusy(false);
      setMsg({ kind: 'err', text: upErr.message });
      return;
    }
    const { data } = supabase.storage
      .from('hotties-profile-images')
      .getPublicUrl(path);
    // Add a cache-bust so the new image actually shows up.
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    const next = [...images];
    next[slot] = publicUrl;
    setImages(next);
    const col = `image_url_${slot + 1}` as
      | 'image_url_1'
      | 'image_url_2'
      | 'image_url_3';
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ [col]: publicUrl })
      .eq('id', user.id);
    setBusy(false);
    if (updErr) {
      setMsg({ kind: 'err', text: updErr.message });
      return;
    }
    setMsg({ kind: 'ok', text: 'Photo updated.' });
    await refreshProfile();
    await revalidatePlayers(username || profile?.username);
  };

  const onRemoveImage = async (slot: 0 | 1 | 2) => {
    setBusy(true);
    setMsg(null);
    const col = `image_url_${slot + 1}` as
      | 'image_url_1'
      | 'image_url_2'
      | 'image_url_3';
    const { error } = await supabase
      .from('profiles')
      .update({ [col]: null })
      .eq('id', user.id);
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    const next = [...images];
    next[slot] = null;
    setImages(next);
    setMsg({ kind: 'ok', text: 'Photo removed.' });
    await refreshProfile();
    await revalidatePlayers(username || profile?.username);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      username: username.trim().toLowerCase(),
      city: city.trim() || null,
      bio: bio.trim() || null,
      ntrp_rating: ntrp === '' ? null : Number(ntrp),
    };
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id);
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    setMsg({ kind: 'ok', text: 'Profile saved.' });
    await refreshProfile();
    await revalidatePlayers(payload.username as string);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-4xl text-white">Your profile</h1>
      <p className="text-white/60 text-sm mt-1">
        Signed in as <span className="text-white">{user.email}</span>
      </p>

      <section className="card p-6 mt-8">
        <h2 className="text-white font-semibold">Photos</h2>
        <p className="text-white/60 text-xs mt-1">
          Up to 3. JPG/PNG, under 5&nbsp;MB each.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <ImageSlot
              key={i}
              url={images[i]}
              disabled={busy}
              onPick={(file) => onUpload(i as 0 | 1 | 2, file)}
              onRemove={() => onRemoveImage(i as 0 | 1 | 2)}
            />
          ))}
        </div>
      </section>

      <form onSubmit={onSave} className="card p-6 mt-6 space-y-4">
        <Field label="Username">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className={inputCls}
          />
        </Field>

        <Field label="NTRP rating">
          <select
            value={ntrp}
            onChange={(e) => setNtrp(e.target.value)}
            className={inputCls}
          >
            <option value="">— not set —</option>
            {NTRP_OPTIONS.map((n) => {
              const key = n.toFixed(1);
              const hint = NTRP_HINTS[key];
              return (
                <option key={key} value={key}>
                  {key}
                  {hint ? ` — ${hint}` : ''}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-white/50 mt-1">
            National Tennis Rating Program scale, 1.0 (new) → 7.0 (pro).
          </p>
        </Field>

        <Field label="City">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Los Angeles"
            className={inputCls}
          />
        </Field>

        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Forehand-heavy. Available weekday evenings."
            className={inputCls}
          />
        </Field>

        {msg && (
          <p className={`text-sm ${msg.kind === 'ok' ? 'text-hot-300' : 'text-red-400'}`}>
            {msg.text}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </main>
  );
}

function ImageSlot({
  url,
  disabled,
  onPick,
  onRemove,
}: {
  url: string | null;
  disabled: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-ink-line bg-ink-soft/60">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="profile" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/40 text-xs">
          empty
        </div>
      )}
      <label
        className={`absolute inset-x-0 bottom-0 cursor-pointer bg-black/60 text-center text-[11px] py-1.5 text-white/90 hover:bg-black/80 ${
          disabled ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {url ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
      </label>
      {url && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute top-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/90 hover:bg-black/80"
        >
          ×
        </button>
      )}
    </div>
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
