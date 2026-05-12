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
      // Don't upload the image bytes — the API only needs lightweight metadata
      // as a seed, and the photo is meant to stay in the browser.
      const res = await fetch('/api/tennis-hottie', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tour,
          selfie: {
            name: selfie.name,
            size: selfie.size,
            type: selfie.type,
          },
        }),
      });
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
      `I'm ${result.similarity}% ${result.name} (${result.tour} #${result.rank}). "${result.aura}"`,
    [result],
  );

  const [sharing, setSharing] = useState(false);

  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderShareCard({ result, selfieUrl });
      if (!blob) throw new Error('Could not render card');
      const file = new File([blob], `tennis-hottie-${slugify(result.name)}.png`, {
        type: 'image/png',
      });

      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean }) : null;
      if (nav && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: `I got ${result.name}!`,
            text: shareText,
          });
          return;
        } catch (err) {
          // user cancelled or share failed → fall through to download
          if (err instanceof Error && err.name === 'AbortError') return;
        }
      }

      // Fallback: trigger a download of the PNG
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setSharing(false);
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
            disabled={sharing}
            className="flex-1 rounded-full bg-hot-500 hover:bg-hot-400 disabled:opacity-60 text-white font-semibold py-3 transition shadow-glow-sm"
          >
            {sharing ? 'Building your card…' : 'Share my card'}
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

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > tr) {
    sw = img.height * tr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / tr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderShareCard({
  result,
  selfieUrl,
}: {
  result: Result;
  selfieUrl: string;
}): Promise<Blob | null> {
  // Vertical IG/TikTok story dimensions
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background gradient (hot pink → ink)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#4d0426');
  bg.addColorStop(0.45, '#171717');
  bg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top pink glow
  const glow = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 900);
  glow.addColorStop(0, 'rgba(255,31,143,0.55)');
  glow.addColorStop(1, 'rgba(255,31,143,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header label
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '600 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WHAT TENNIS HOTTIE ARE YOU?', W / 2, 140);

  // Similarity pill
  const pillW = 360, pillH = 70, pillX = (W - pillW) / 2, pillY = 190;
  ctx.fillStyle = '#ff1f8f';
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 32px system-ui, sans-serif';
  ctx.fillText(`VIBE MATCH · ${result.similarity}%`, W / 2, pillY + 46);

  // "You are…"
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '500 34px system-ui, sans-serif';
  ctx.fillText('You are…', W / 2, 340);

  // Player name
  ctx.fillStyle = '#fff';
  ctx.font = '800 96px system-ui, sans-serif';
  ctx.fillText(result.name, W / 2, 440);

  // Tour + rank
  ctx.fillStyle = '#ff7ebe';
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.fillText(`${result.tour} · World Rank #${result.rank}`, W / 2, 495);

  // Selfie + player images (side by side)
  const imgSize = 380;
  const gap = 60;
  const imgY = 560;
  const totalW = imgSize * 2 + gap;
  const leftX = (W - totalW) / 2;
  const rightX = leftX + imgSize + gap;

  try {
    const [selfieImg, playerImg] = await Promise.all([
      loadImage(selfieUrl),
      loadImage(result.image),
    ]);
    // selfie
    ctx.save();
    roundRectPath(ctx, leftX, imgY, imgSize, imgSize, 40);
    ctx.clip();
    drawImageCover(ctx, selfieImg, leftX, imgY, imgSize, imgSize);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,31,143,0.8)';
    ctx.lineWidth = 6;
    roundRectPath(ctx, leftX, imgY, imgSize, imgSize, 40);
    ctx.stroke();

    // ≈ separator
    ctx.fillStyle = '#ff4aa4';
    ctx.font = '800 100px system-ui, sans-serif';
    ctx.fillText('≈', W / 2, imgY + imgSize / 2 + 36);

    // player
    ctx.save();
    roundRectPath(ctx, rightX, imgY, imgSize, imgSize, 40);
    ctx.clip();
    drawImageCover(ctx, playerImg, rightX, imgY, imgSize, imgSize);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,31,143,0.8)';
    ctx.lineWidth = 6;
    roundRectPath(ctx, rightX, imgY, imgSize, imgSize, 40);
    ctx.stroke();
  } catch (e) {
    console.error(e);
  }

  // Aura
  ctx.fillStyle = '#ffd6ec';
  ctx.font = 'italic 600 44px system-ui, sans-serif';
  ctx.fillText(`“${result.aura}”`, W / 2, imgY + imgSize + 100);

  // Pills (2x2)
  const pills = [
    ['Court Personality', result.courtPersonality],
    ['Red Flag', result.redFlag],
    ['Doubles Energy', result.doublesEnergy],
    ['Tennis Aura', result.aura],
  ];
  const pCols = 2;
  const pW = 460, pH = 130, pGap = 30;
  const pStartX = (W - (pCols * pW + (pCols - 1) * pGap)) / 2;
  const pStartY = imgY + imgSize + 160;
  pills.forEach((p, i) => {
    const col = i % pCols;
    const row = Math.floor(i / pCols);
    const x = pStartX + col * (pW + pGap);
    const y = pStartY + row * (pH + pGap);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRectPath(ctx, x, y, pW, pH, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(p[0].toUpperCase(), x + 24, y + 42);
    ctx.fillStyle = '#fff';
    ctx.font = '600 32px system-ui, sans-serif';
    // truncate long values to one line
    let val = p[1];
    while (ctx.measureText(val).width > pW - 48 && val.length > 4) {
      val = val.slice(0, -2);
    }
    if (val !== p[1]) val = val.slice(0, -1) + '…';
    ctx.fillText(val, x + 24, y + 90);
  });

  // Caption (wrapped)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '700 40px system-ui, sans-serif';
  const captionLines = wrapText(ctx, result.funnyCaption, W - 160);
  let cy = pStartY + 2 * (pH + pGap) + 80;
  for (const line of captionLines) {
    ctx.fillText(line, W / 2, cy);
    cy += 56;
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText('hottiesthat.hit · What Tennis Hottie Are You?', W / 2, H - 80);

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
}
