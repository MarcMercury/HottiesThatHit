import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'About · Hotties That Hit' };

export default function AboutPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Our story"
        title="Built by people who hate refreshing booking sites."
        subtitle="Hotties That Hit is the fastest way to find an open court in LA — and soon, the people to play on it with."
      />

      <section className="mx-auto max-w-3xl px-4 py-10 prose prose-invert prose-pink">
        <p className="text-white/75">
          We started this because finding a court at 6pm on a Tuesday in LA shouldn&apos;t require
          three browser tabs and a prayer. We aggregate every public reservation system in
          the city — LA Rec & Parks, Beverly Hills, Santa Monica, Pasadena, the universities —
          and surface the open times in one place.
        </p>
        <p className="text-white/75 mt-4">
          Phase one: courts. Phase two: players. Phase three: leagues, ladders, the whole vibe.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 not-prose">
          <Stat label="Facilities tracked" value="60+" />
          <Stat label="Slots scanned daily" value="2,000+" />
          <Stat label="Cities" value="1 (LA)" />
        </div>

        <div className="mt-10 not-prose">
          <Link href="/slots" className="btn-primary">See open courts</Link>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="font-display text-3xl text-hot-400 neon-text">{value}</p>
      <p className="mt-1 text-xs text-white/55 uppercase tracking-wider">{label}</p>
    </div>
  );
}
