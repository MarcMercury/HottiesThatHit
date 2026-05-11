// Landing page — hero, value props, CTA. Themed to the HTH logo.
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-neon-radial pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-12 sm:pt-12 sm:pb-20 md:pt-20 md:pb-28 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
          <div className="order-2 md:order-1">
            <span className="chip">Now serving Los Angeles</span>
            <h1 className="mt-3 sm:mt-4 font-display text-5xl sm:text-6xl md:text-7xl text-white neon-text leading-[0.95]">
              <span className="text-hot-400">Hotties</span>
              <br />
              <span className="text-white">that Hit.</span>
            </h1>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-white/75 max-w-xl">
              Every open tennis court in LA — public, private, lit, clay — on one screen.
              Find courts, find players, hit harder.
            </p>
            <div className="mt-6 sm:mt-7 flex flex-wrap gap-3">
              <Link href="/courts" className="btn-primary">
                See tonight&apos;s open courts
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/players" className="btn-ghost">Find a hitting partner</Link>
            </div>
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/50">
              <div><span className="text-hot-300 font-bold text-base">60+</span> facilities</div>
              <div><span className="text-hot-300 font-bold text-base">2,000+</span> daily slots</div>
              <div><span className="text-hot-300 font-bold text-base">Live</span> updated hourly</div>
            </div>
          </div>

          <div className="order-1 md:order-2 relative mx-auto w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] md:w-[520px] md:h-[520px] max-w-full">
            <div className="absolute -inset-8 rounded-full bg-hot-500/30 blur-3xl pointer-events-none" />
            <Image
              src="/hero.png"
              alt="Hotties That Hit"
              width={520}
              height={520}
              priority
              className="relative object-contain w-full h-full drop-shadow-[0_10px_40px_rgba(255,31,143,0.45)]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <h2 className="font-display text-2xl sm:text-3xl text-white mb-5 sm:mb-6">The whole court, covered.</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <FeatureCard href="/courts" title="Find a Court" tag="Map + List"
            desc="Every public court in LA + NYC on a map or as a sortable list. Filter by surface, lights, location, fee. Save your favorites." emoji="📍" />
          <FeatureCard href="/open-play" title="Open Play" tag="New"
            desc="Post a match you've set up. Claim a spot in someone else's. Show up and hit." emoji="🤝" />
          <FeatureCard href="/players" title="Find Players" tag="Hitters"
            desc="Browse hitters near you, filter by level, and ping a partner before your next session." emoji="🎾" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="card p-5 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-hot-300">Coverage</p>
              <p className="mt-1 text-white/90 text-base sm:text-lg">
                LA Rec & Parks · Beverly Hills · Santa Monica · Pasadena · UCLA · USC
              </p>
              <p className="text-white/50 text-sm">SF Bay & NYC dropping next.</p>
            </div>
            <Link href="/courts" className="btn-primary self-start sm:self-auto">Play tonight</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="relative overflow-hidden rounded-3xl border border-hot-500/40 bg-gradient-to-br from-hot-700/30 via-ink-soft to-ink p-7 sm:p-10 md:p-14 text-center">
          <div className="absolute inset-0 bg-neon-radial pointer-events-none" />
          <h3 className="relative font-display text-3xl sm:text-4xl md:text-5xl text-white neon-text leading-tight">
            Stop refreshing 12 booking sites.
          </h3>
          <p className="relative mt-3 text-white/70 max-w-xl mx-auto text-sm sm:text-base">
            We do it for you. One screen, every court, every night. Pink courts only.
          </p>
          <div className="relative mt-6">
            <Link href="/courts" className="btn-primary">Show me courts →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ href, title, desc, tag, emoji }: {
  href: string; title: string; desc: string; tag?: string; emoji: string;
}) {
  return (
    <Link href={href} className="card group p-5 transition hover:border-hot-500/60 hover:shadow-glow-sm">
      <div className="flex items-start justify-between">
        <span className="text-3xl">{emoji}</span>
        {tag && <span className="chip">{tag}</span>}
      </div>
      <h3 className="mt-4 font-semibold text-white text-lg">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{desc}</p>
      <p className="mt-4 text-xs text-hot-300 group-hover:text-hot-200">Open →</p>
    </Link>
  );
}
