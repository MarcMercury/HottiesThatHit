'use client';

import { useRef, useState } from 'react';

const LOADING_LINES = [
  'Warming up the anime arc…',
  'Perfecting your serve form…',
  'Adding neon court lights…',
  'Selecting the perfect slogan…',
  'Choosing your power pose…',
  'Painting those glossy highlights…',
  'Setting the cinematic scene…',
  'Finalizing your court fit…',
];

type Gender = 'female' | 'male';

export default function MakeMeAHottieClient() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState(LOADING_LINES[0]);
  const [result, setResult] = useState<string | null>(null); // base64 image
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setResult(null);
    setError(null);
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const generate = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Rotate loading lines for fun
    let idx = 0;
    setLoadingLine(LOADING_LINES[0]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_LINES.length;
      setLoadingLine(LOADING_LINES[idx]);
    }, 2500);

    try {
      const form = new FormData();
      form.append('image', photo);
      if (gender) form.append('gender', gender);

      const res = await fetch('/api/make-me-a-hottie', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json() as { image?: string; error?: string };
      if (!data.image) throw new Error(data.error ?? 'No image returned');
      setResult(data.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      setLoading(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setPhotoUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${result}`;
    a.download = 'my-hottie.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    if (!result) return;
    try {
      const byteString = atob(result);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });
      const file = new File([blob], 'my-hottie.png', { type: 'image/png' });

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'My Anime Tennis Hottie',
          text: 'Check out my anime tennis alter-ego from Hotties That Hit! 🎾✨',
        });
      } else {
        download();
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') download();
    }
  };

  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 bg-neon-radial pointer-events-none" />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">

        {/* Header */}
        <header className="text-center mb-8">
          <p className="text-hot-300 text-sm uppercase tracking-[0.25em]">AI · Anime Edition</p>
          <h1 className="font-display text-4xl sm:text-6xl text-white mt-2">
            Make Me a <span className="text-hot-400">Hottie</span>
          </h1>
          <p className="mt-3 text-white/70 max-w-xl mx-auto">
            Upload a photo and our AI will transform you into a premium anime tennis star —
            your look, your energy, your court moment.
          </p>
        </header>

        {/* Upload + Generate panel */}
        {!result && (
          <div className="rounded-2xl border border-ink-line bg-ink-soft/70 p-5 sm:p-7 shadow-glow-sm">

            {/* Upload zone */}
            <label
              htmlFor="hottie-photo-input"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-hot-500/60 bg-ink/60 px-6 py-10 cursor-pointer hover:border-hot-400 transition"
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Your photo"
                  className="h-44 w-44 rounded-2xl object-cover ring-4 ring-hot-500/70 shadow-glow"
                />
              ) : (
                <div className="h-44 w-44 rounded-2xl border-2 border-hot-500/40 bg-ink flex flex-col items-center justify-center text-hot-400 gap-2">
                  {/* Camera icon */}
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="text-sm text-white/40">Upload photo</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-medium">
                  {photo ? 'Drop a different one or tap to change' : 'Drop your photo or tap to upload'}
                </p>
                <p className="text-white/50 text-sm mt-0.5">PNG, JPG, HEIC · max 8 MB</p>
              </div>
              <input
                ref={fileInputRef}
                id="hottie-photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {/* Tips */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-white/50 text-center">
              <div className="rounded-lg bg-ink/60 px-3 py-2">✦ Clear face = better result</div>
              <div className="rounded-lg bg-ink/60 px-3 py-2">✦ Good lighting helps a lot</div>
              <div className="rounded-lg bg-ink/60 px-3 py-2">✦ Every gen is unique</div>
            </div>

            {/* Gender selector — picks wardrobe + body styling */}
            <div className="mt-5">
              <p className="text-center text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
                Style as
              </p>
              <div className="flex items-center justify-center gap-3">
                {(['female', 'male'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`min-w-[120px] rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wider transition border ${
                      gender === g
                        ? 'bg-hot-500 text-white border-hot-400 shadow-glow-sm'
                        : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {g === 'female' ? '♀ Female' : '♂ Male'}
                  </button>
                ))}
              </div>
              {!gender && (
                <p className="mt-2 text-center text-xs text-white/40">
                  Pick one so the AI dresses you correctly.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={!photo || !gender || loading}
                onClick={generate}
                className="flex-1 rounded-full bg-hot-500 hover:bg-hot-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 transition shadow-glow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    {loadingLine}
                  </>
                ) : '🎾 Generate my anime hottie'}
              </button>
              {photo && !loading && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full bg-white/5 hover:bg-white/10 text-white/80 py-3 px-5 transition"
                >
                  Reset
                </button>
              )}
            </div>

            {error && (
              <p className="mt-4 text-center text-sm text-hot-300">{error}</p>
            )}

            <p className="mt-6 text-center text-xs text-white/40">
              Your photo is sent to OpenAI to generate the image and is not stored by us.
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="animate-[fadeIn_.4s_ease-out]">
            <div className="relative mx-auto max-w-md rounded-3xl border border-hot-500/40 bg-gradient-to-b from-ink-soft to-ink p-6 shadow-glow">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-hot-500 px-3 py-1 text-xs uppercase tracking-widest text-white shadow-glow-sm whitespace-nowrap">
                ✦ Anime Hottie Unlocked
              </div>

              {/* Side by side comparison */}
              {photoUrl && (
                <div className="mt-4 flex items-center justify-center gap-4 mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt="You"
                    className="h-28 w-28 rounded-2xl object-cover ring-2 ring-white/30"
                  />
                  <div className="text-3xl text-hot-400">→</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${result}`}
                    alt="Your anime tennis hottie"
                    className="h-28 w-28 rounded-2xl object-cover ring-2 ring-hot-500/70 shadow-glow"
                  />
                </div>
              )}

              {/* Full generated image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${result}`}
                alt="Your anime tennis hottie"
                className="w-full rounded-2xl object-cover shadow-glow-sm"
              />

              {/* Action buttons */}
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 rounded-full bg-hot-500 hover:bg-hot-400 text-white font-semibold py-3 transition shadow-glow-sm"
                >
                  Share 🎾
                </button>
                <button
                  type="button"
                  onClick={download}
                  className="flex-1 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold py-3 transition"
                >
                  Download
                </button>
              </div>

              <button
                type="button"
                onClick={reset}
                className="mt-3 w-full rounded-full bg-white/5 hover:bg-white/10 text-white/70 py-2.5 text-sm transition"
              >
                Generate another
              </button>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}
