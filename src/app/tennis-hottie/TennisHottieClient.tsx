'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import type { TennisPlayer } from '@/lib/tennisPlayers';

type Result = TennisPlayer & { similarity: number; seed: string };

type TourFilter = 'ANY' | 'ATP' | 'WTA';

export default function TennisHottieClient() {
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [tour, setTour] = useState<TourFilter>('ANY');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selfie) {
      setSelfieUrl(null);
      return;
    }
    const url = URL.createObjectURL(selfie);
    setSelfieUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selfie]);

  const handleFile = (file: File | null) => {
    setResult(null);
    setError(null);
    setSelfie(file);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const analyze = async () => {
    if (!selfie) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('selfie', selfie);
      fd.append('tour', tour);
      const res = await fetch('/api/tennis-hottie', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as Result;
      // mini suspense
      await new Promise((r) => setTimeout(r, 600));
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelfie(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 bg-neon-radial pointer-events-none" />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="text-center mb-8">
          <p className="text-hot-300 text-sm uppercase tracking-[0.25em]">
            New · Vibe analysis
          </p>
          <h1 className="font-display text-4xl sm:text-6xl text-white mt-2">
            What <span className="text-hot-400">Tennis Hottie</span> Are You?
          </h1>
          <p className="mt-3 text-white/70 max-w-xl mx-auto">
            Upload a selfie and we&apos;ll match you to an ATP or WTA player based on
            pure vibe — chaotic golden retriever energy, silent killer mode,
            country club assassin, you name it.
          </p>
        </header>

        {!result && (
          <div className="rounded-2xl border border-ink-line bg-ink-soft/70 p-5 sm:p-7 shadow-glow-sm">
            <div className="flex items-center justify-center gap-2 mb-4">
              {(['ANY', 'ATP', 'WTA'] as TourFilter[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTour(t)}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider transition ${
                    tour === t
                      ? 'bg-hot-500 text-white shadow-glow-sm'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t === 'ANY' ? 'Any tour (funnier)' : t}
                </button>
              ))}
            </div>

            <label
              htmlFor="selfie-input"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-hot-500/60 bg-ink/60 px-6 py-10 cursor-pointer hover:border-hot-400 transition"
            >
              {selfieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selfieUrl}
                  alt="Your selfie"
                  className="h-40 w-40 rounded-full object-cover ring-4 ring-hot-500/70 shadow-glow"
                />
              ) : (
                <div className="h-40 w-40 rounded-full border-2 border-hot-500/40 bg-ink flex items-center justify-center text-hot-400 text-5xl">
                  ＋
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-medium">
                  {selfie ? 'Drop a different one or tap to change' : 'Drop your selfie or tap to upload'}
                </p>
                <p className="text-white/50 text-sm">PNG, JPG, HEIC · stays in your browser</p>
              </div>
              <input
                ref={fileInputRef}
                id="selfie-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={!selfie || loading}
                onClick={analyze}
                className="flex-1 rounded-full bg-hot-500 hover:bg-hot-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 transition shadow-glow-sm"
              >
                {loading ? 'Reading your aura…' : 'Reveal my tennis hottie'}
              </button>
              {selfie && (
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
              Not real biometrics. It&apos;s a vibe check.
            </p>
          </div>
        )}

        {result && selfieUrl && (
          <ResultCard result={result} selfieUrl={selfieUrl} onReset={reset} />
        )}
      </section>
    </main>
  );
}

function ResultCard({
  result,
  selfieUrl,
  onReset,
}: {
  result: Result;
  selfieUrl: string;
  onReset: () => void;
}) {
  const shareText = useMemo(
    () =>
      `I'm ${result.similarity}% ${result.name} (${result.tour} #${result.rank}). "${result.aura}" — find your tennis hottie at hottiesthat.hit`,
    [result],
  );

  const share = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `I got ${result.name}!`,
          text: shareText,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        });
        return;
      } catch {
        /* fallthrough */
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      alert('Copied share text to clipboard!');
    }
  };

  return (
    <div className="animate-[fadeIn_.4s_ease-out]">
      <div className="relative mx-auto max-w-md rounded-3xl border border-hot-500/40 bg-gradient-to-b from-ink-soft to-ink p-6 shadow-glow">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-hot-500 px-3 py-1 text-xs uppercase tracking-widest text-white shadow-glow-sm">
          Vibe match · {result.similarity}%
        </div>

        <p className="text-center text-white/60 uppercase tracking-widest text-xs mt-3">
          You are…
        </p>
        <h2 className="text-center font-display text-4xl text-white mt-1">
          {result.name}
        </h2>
        <p className="text-center text-hot-300 text-sm mt-1">
          {result.tour} · World Rank #{result.rank}
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selfieUrl}
            alt="You"
            className="h-28 w-28 rounded-2xl object-cover ring-2 ring-hot-500/70"
          />
          <div className="text-4xl text-hot-400">≈</div>
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-hot-500/70">
            <Image
              src={result.image}
              alt={result.name}
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-white/80 font-medium mb-1">Why you match:</p>
          <ul className="list-disc list-inside space-y-1 text-white/80 text-sm">
            {result.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Pill label="Tennis Aura" value={result.aura} />
          <Pill label="Court Personality" value={result.courtPersonality} />
          <Pill label="Red Flag" value={result.redFlag} />
          <Pill label="Doubles Energy" value={result.doublesEnergy} />
        </div>

        <p className="mt-6 text-center italic text-hot-200">
          “{result.funnyCaption}”
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={share}
            className="flex-1 rounded-full bg-hot-500 hover:bg-hot-400 text-white font-semibold py-3 transition shadow-glow-sm"
          >
            Share my card
          </button>
          <button
            onClick={onReset}
            className="rounded-full bg-white/5 hover:bg-white/10 text-white/80 py-3 px-5 transition"
          >
            Try another selfie
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-white/40">
          Player photos · Wikipedia / Wikimedia Commons
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/50">
        {label}
      </div>
      <div className="text-white/90">{value}</div>
    </div>
  );
}
