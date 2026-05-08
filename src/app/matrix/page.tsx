'use client';

// Hot vs Hit Matrix — a fun riff on the classic "Hot/Crazy" matrix,
// reskinned for tennis: NTRP rating (1.0–5.0) vs Hotness (1–10).
// User enters their numbers and we plot them on the chart.

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';

// Chart geometry (SVG user units). Padding leaves room for axis labels.
const VB = { w: 640, h: 640 };
const PAD = { l: 70, r: 24, t: 24, b: 70 };
const PLOT = {
  x: PAD.l,
  y: PAD.t,
  w: VB.w - PAD.l - PAD.r,
  h: VB.h - PAD.t - PAD.b,
};

// Domain: Hit = NTRP 1.0..5.0, Hot = 1..10.
const HIT_MIN = 1.0;
const HIT_MAX = 5.0;
const HOT_MIN = 1;
const HOT_MAX = 10;

function hitToX(hit: number) {
  const t = (hit - HIT_MIN) / (HIT_MAX - HIT_MIN);
  return PLOT.x + t * PLOT.w;
}
function hotToY(hot: number) {
  const t = (hot - HOT_MIN) / (HOT_MAX - HOT_MIN);
  // Y axis is inverted in SVG.
  return PLOT.y + (1 - t) * PLOT.h;
}

// The diagonal "Hot Hit Line" maps Hit 1.0→Hot 1, Hit 5.0→Hot 10.
// hot = 1 + (hit - 1) * (9 / 4) = 2.25*hit - 1.25
function hotHitLine(hit: number) {
  return 2.25 * hit - 1.25;
}

type Zone = {
  key: string;
  title: string;
  blurb: string;
  // rectangle in domain coords [hitMin, hitMax, hotMin, hotMax]
  rect: [number, number, number, number];
  tone: 'danger' | 'warn' | 'fun' | 'good' | 'gold';
};

// Zones below the diagonal (Hit ≥ what their Hot would predict) are the "playable" zones.
// Zones above the diagonal lean "all looks, no game".
const ZONES: Zone[] = [
  // ABOVE the line — looks > game
  {
    key: 'no-go',
    title: 'No Go Zone',
    blurb: 'Hot. Cannot hit. Will rage-quit at 2-2.',
    rect: [1.0, 2.5, 7, 10],
    tone: 'danger',
  },
  {
    key: 'catfish',
    title: 'Catfish Court',
    blurb: 'Cute kit, brand new strings, zero rallies.',
    rect: [2.5, 4.0, 8, 10],
    tone: 'warn',
  },
  // ON / NEAR the line — beginner buddies
  {
    key: 'rec-rally',
    title: 'Rec Park Rally',
    blurb: 'Pure vibes. Bring a speaker, not a scorecard.',
    rect: [1.0, 2.5, 1, 7],
    tone: 'fun',
  },
  // BELOW the line — Hit ≥ Hot expectation
  {
    key: 'fun',
    title: 'Fun Zone',
    blurb: 'Solid hit, easy hang. The bread and butter.',
    rect: [2.5, 4.0, 1, 8],
    tone: 'fun',
  },
  {
    key: 'hitting-partner',
    title: 'Hitting Partner',
    blurb: 'Books courts, keeps score, texts back.',
    rect: [4.0, 5.0, 1, 5],
    tone: 'good',
  },
  {
    key: 'date',
    title: 'Date Zone',
    blurb: 'Brunch after the third set. Highly recommended.',
    rect: [4.0, 5.0, 5, 7],
    tone: 'good',
  },
  {
    key: 'wife',
    title: 'Wife Zone',
    blurb: 'Mixed doubles legend. Lock it in.',
    rect: [4.0, 5.0, 7, 9],
    tone: 'gold',
  },
  {
    key: 'unicorn',
    title: 'Unicorn',
    blurb: '5.0 and a 10. Statistically does not exist. Allegedly.',
    rect: [4.0, 5.0, 9, 10],
    tone: 'gold',
  },
];

const TONE_FILL: Record<Zone['tone'], string> = {
  danger: 'rgba(255, 31, 143, 0.18)',
  warn: 'rgba(255, 122, 0, 0.14)',
  fun: 'rgba(216, 242, 74, 0.08)',
  good: 'rgba(255, 31, 143, 0.10)',
  gold: 'rgba(255, 215, 0, 0.16)',
};
const TONE_STROKE: Record<Zone['tone'], string> = {
  danger: 'rgba(255, 31, 143, 0.55)',
  warn: 'rgba(255, 170, 80, 0.45)',
  fun: 'rgba(216, 242, 74, 0.35)',
  good: 'rgba(255, 122, 190, 0.45)',
  gold: 'rgba(255, 215, 0, 0.65)',
};

function zoneRect(z: Zone) {
  const [h0, h1, t0, t1] = z.rect;
  const x0 = hitToX(h0);
  const x1 = hitToX(h1);
  const y0 = hotToY(t1); // top
  const y1 = hotToY(t0); // bottom
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function classifyPoint(hit: number, hot: number): Zone | null {
  // Find the smallest zone (by area in domain) that contains the point.
  const candidates = ZONES.filter(
    (z) => hit >= z.rect[0] && hit <= z.rect[1] && hot >= z.rect[2] && hot <= z.rect[3],
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const aa = (a.rect[1] - a.rect[0]) * (a.rect[3] - a.rect[2]);
    const bb = (b.rect[1] - b.rect[0]) * (b.rect[3] - b.rect[2]);
    return aa - bb;
  });
  return candidates[0];
}

export default function MatrixPage() {
  const [hitStr, setHitStr] = useState('3.5');
  const [hotStr, setHotStr] = useState('7');
  const [plotted, setPlotted] = useState<{ hit: number; hot: number } | null>({
    hit: 3.5,
    hot: 7,
  });

  const parsed = useMemo(() => {
    const hit = Number(hitStr);
    const hot = Number(hotStr);
    const hitOk = Number.isFinite(hit) && hit >= HIT_MIN && hit <= HIT_MAX;
    const hotOk = Number.isFinite(hot) && hot >= HOT_MIN && hot <= HOT_MAX;
    return { hit, hot, hitOk, hotOk, ok: hitOk && hotOk };
  }, [hitStr, hotStr]);

  const verdict = useMemo(() => {
    if (!plotted) return null;
    return classifyPoint(plotted.hit, plotted.hot);
  }, [plotted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.ok) return;
    setPlotted({ hit: parsed.hit, hot: parsed.hot });
  };

  // Axis tick values
  const hitTicks = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const hotTicks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <main>
      <PageHeader
        eyebrow="Just for fun"
        title="Hot vs Hit Matrix"
        subtitle="A scientifically irresponsible chart. Plot your NTRP rating against your hotness and find your zone."
      />

      <section className="mx-auto max-w-6xl px-4 py-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Chart */}
        <div className="card p-4 md:p-6">
          <div className="rounded-2xl bg-black/80 border border-ink-line overflow-hidden">
            <svg
              viewBox={`0 0 ${VB.w} ${VB.h}`}
              className="w-full h-auto block"
              role="img"
              aria-label="Hot vs Hit matrix chart"
            >
              <defs>
                <radialGradient id="bgGlow" cx="50%" cy="0%" r="80%">
                  <stop offset="0%" stopColor="rgba(255,31,143,0.25)" />
                  <stop offset="60%" stopColor="rgba(255,31,143,0)" />
                </radialGradient>
                <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect x={0} y={0} width={VB.w} height={VB.h} fill="#0a0a0a" />
              <rect x={0} y={0} width={VB.w} height={VB.h} fill="url(#bgGlow)" />

              {/* Plot frame */}
              <rect
                x={PLOT.x}
                y={PLOT.y}
                width={PLOT.w}
                height={PLOT.h}
                fill="#000"
                stroke="#ffffff"
                strokeWidth={2}
              />

              {/* Zones */}
              {ZONES.map((z) => {
                const r = zoneRect(z);
                return (
                  <g key={z.key}>
                    <rect
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      fill={TONE_FILL[z.tone]}
                      stroke={TONE_STROKE[z.tone]}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {/* "No Go" hatching */}
              <pattern
                id="hatch"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
              </pattern>
              {(() => {
                const r = zoneRect(ZONES.find((z) => z.key === 'no-go')!);
                return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#hatch)" />;
              })()}

              {/* Zone labels */}
              {ZONES.map((z) => {
                const r = zoneRect(z);
                const big = r.w > 80 && r.h > 50;
                const fontSize = big ? 18 : 13;
                return (
                  <text
                    key={`lbl-${z.key}`}
                    x={r.cx}
                    y={r.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    fontFamily="var(--font-display), cursive"
                    fontSize={fontSize}
                    style={{ letterSpacing: 0.5 }}
                  >
                    {z.title.toUpperCase()}
                  </text>
                );
              })}

              {/* Hot Hit Line (diagonal) */}
              <line
                x1={hitToX(HIT_MIN)}
                y1={hotToY(hotHitLine(HIT_MIN))}
                x2={hitToX(HIT_MAX)}
                y2={hotToY(hotHitLine(HIT_MAX))}
                stroke="#ffffff"
                strokeWidth={3}
                markerEnd="url(#arrow)"
              />
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="#ffffff" />
                </marker>
              </defs>
              {/* Diagonal label */}
              <g
                transform={`translate(${hitToX(2.6)}, ${hotToY(hotHitLine(2.6))}) rotate(-32)`}
              >
                <text
                  fill="#ffffff"
                  fontFamily="var(--font-display), cursive"
                  fontSize={16}
                  textAnchor="middle"
                  dy={-8}
                >
                  HOT HIT LINE
                </text>
              </g>

              {/* Axis ticks — X (Hit) */}
              {hitTicks.map((t) => (
                <g key={`xt-${t}`}>
                  <line
                    x1={hitToX(t)}
                    y1={PLOT.y + PLOT.h}
                    x2={hitToX(t)}
                    y2={PLOT.y + PLOT.h + 6}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={hitToX(t)}
                    y={PLOT.y + PLOT.h + 22}
                    fill="#ffffff"
                    fontSize={13}
                    textAnchor="middle"
                  >
                    {t.toFixed(1)}
                  </text>
                </g>
              ))}
              {/* Axis ticks — Y (Hot) */}
              {hotTicks.map((t) => (
                <g key={`yt-${t}`}>
                  <line
                    x1={PLOT.x - 6}
                    y1={hotToY(t)}
                    x2={PLOT.x}
                    y2={hotToY(t)}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={PLOT.x - 12}
                    y={hotToY(t) + 4}
                    fill="#ffffff"
                    fontSize={13}
                    textAnchor="end"
                  >
                    {t}
                  </text>
                </g>
              ))}

              {/* Axis titles */}
              <text
                x={PLOT.x + PLOT.w / 2}
                y={VB.h - 18}
                fill="#ffffff"
                fontFamily="var(--font-display), cursive"
                fontSize={26}
                textAnchor="middle"
                style={{ letterSpacing: 2 }}
              >
                HIT (NTRP)
              </text>
              <text
                transform={`translate(22, ${PLOT.y + PLOT.h / 2}) rotate(-90)`}
                fill="#ffffff"
                fontFamily="var(--font-display), cursive"
                fontSize={26}
                textAnchor="middle"
                style={{ letterSpacing: 2 }}
              >
                HOT
              </text>

              {/* Plotted point */}
              {plotted && (
                <g filter="url(#dotGlow)">
                  <circle
                    cx={hitToX(plotted.hit)}
                    cy={hotToY(plotted.hot)}
                    r={11}
                    fill="#ff1f8f"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <circle
                    cx={hitToX(plotted.hit)}
                    cy={hotToY(plotted.hot)}
                    r={4}
                    fill="#ffffff"
                  />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Controls */}
        <aside className="space-y-4">
          <form onSubmit={handleSubmit} className="card p-5 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-hot-300 mb-1">
                Your NTRP rating ({HIT_MIN.toFixed(1)}–{HIT_MAX.toFixed(1)})
              </label>
              <input
                type="number"
                step="0.1"
                min={HIT_MIN}
                max={HIT_MAX}
                value={hitStr}
                onChange={(e) => setHitStr(e.target.value)}
                className="w-full rounded-md bg-ink-soft border border-ink-line px-3 py-2 text-white outline-none focus:border-hot-400"
              />
              <input
                type="range"
                step="0.1"
                min={HIT_MIN}
                max={HIT_MAX}
                value={parsed.hitOk ? parsed.hit : HIT_MIN}
                onChange={(e) => setHitStr(e.target.value)}
                className="w-full mt-2 accent-hot-500"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-hot-300 mb-1">
                Your hotness ({HOT_MIN}–{HOT_MAX})
              </label>
              <input
                type="number"
                step="0.1"
                min={HOT_MIN}
                max={HOT_MAX}
                value={hotStr}
                onChange={(e) => setHotStr(e.target.value)}
                className="w-full rounded-md bg-ink-soft border border-ink-line px-3 py-2 text-white outline-none focus:border-hot-400"
              />
              <input
                type="range"
                step="0.1"
                min={HOT_MIN}
                max={HOT_MAX}
                value={parsed.hotOk ? parsed.hot : HOT_MIN}
                onChange={(e) => setHotStr(e.target.value)}
                className="w-full mt-2 accent-hot-500"
              />
            </div>

            {!parsed.ok && (hitStr || hotStr) && (
              <p className="text-xs text-hot-300">
                Enter NTRP {HIT_MIN.toFixed(1)}–{HIT_MAX.toFixed(1)} and Hot {HOT_MIN}–{HOT_MAX}.
              </p>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={!parsed.ok}>
                Plot me
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPlotted(null)}
              >
                Clear
              </button>
            </div>
          </form>

          {plotted && (
            <div className="card p-5">
              <p className="text-xs uppercase tracking-widest text-hot-300">Verdict</p>
              <p className="mt-1 font-display text-3xl text-white neon-text">
                {verdict ? verdict.title : 'Off the chart'}
              </p>
              <p className="mt-2 text-white/70 text-sm">
                {verdict?.blurb ?? 'Literally outside the matrix. Respect.'}
              </p>
              <p className="mt-3 text-xs text-white/50">
                NTRP <span className="text-white/80">{plotted.hit.toFixed(1)}</span> · Hot{' '}
                <span className="text-white/80">{plotted.hot.toFixed(1)}</span>
              </p>
            </div>
          )}

          <div className="card p-5 text-xs text-white/55 leading-relaxed">
            <p className="text-white/70 font-semibold mb-1">Disclaimer</p>
            This chart is a joke. Hotness is subjective, NTRP is self-reported, and the only
            real rating that matters is whether you show up on time with new balls.
          </div>
        </aside>
      </section>
    </main>
  );
}
