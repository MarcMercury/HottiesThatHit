import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';

const SAMPLE = [
  { name: 'Cheviot Hills Recreation', neighborhood: 'West LA', surface: 'Hard', lights: true, courts: 14, fee: '$8/hr' },
  { name: 'Westwood Recreation Center', neighborhood: 'Westwood', surface: 'Hard', lights: true, courts: 8, fee: '$8/hr' },
  { name: 'Riverside Tennis Courts', neighborhood: 'Burbank', surface: 'Hard', lights: true, courts: 6, fee: '$5/hr' },
  { name: 'Reed Park', neighborhood: 'Santa Monica', surface: 'Hard', lights: false, courts: 4, fee: 'Free' },
  { name: 'Plummer Park', neighborhood: 'West Hollywood', surface: 'Hard', lights: true, courts: 4, fee: 'Free' },
  { name: 'Roxbury Park', neighborhood: 'Beverly Hills', surface: 'Hard', lights: true, courts: 4, fee: '$10/hr' },
];

export const metadata = { title: 'Find a Court · Hotties That Hit' };

export default function CourtsPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Directory"
        title="Find a Court"
        subtitle="Browse every facility we track. Filters and a real map are landing soon — for now, here's the lineup."
      />

      <section className="mx-auto max-w-6xl px-4 py-8">
        {/* Filter chips (visual only for now) */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['All', 'Lights', 'Free', 'Clay', 'Hard', 'West LA', 'Eastside', 'Valley'].map((f) => (
            <button
              key={f}
              className="chip hover:bg-hot-500/25 hover:text-white transition"
              type="button"
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SAMPLE.map((c) => (
            <div key={c.name} className="card p-5 hover:border-hot-500/60 hover:shadow-glow-sm transition">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-white">{c.name}</h3>
                <span className="chip">{c.fee}</span>
              </div>
              <p className="mt-1 text-sm text-white/55">{c.neighborhood}</p>
              <ul className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/70">
                <li className="rounded-md border border-ink-line bg-ink-soft/60 p-2 text-center">
                  <p className="text-hot-300 font-bold">{c.courts}</p>
                  <p className="text-white/50">courts</p>
                </li>
                <li className="rounded-md border border-ink-line bg-ink-soft/60 p-2 text-center">
                  <p className="text-hot-300 font-bold">{c.surface}</p>
                  <p className="text-white/50">surface</p>
                </li>
                <li className="rounded-md border border-ink-line bg-ink-soft/60 p-2 text-center">
                  <p className="text-hot-300 font-bold">{c.lights ? 'Yes' : 'No'}</p>
                  <p className="text-white/50">lights</p>
                </li>
              </ul>
              <Link
                href={`/slots?facility=${encodeURIComponent(c.name)}`}
                className="mt-4 inline-flex text-sm text-hot-300 hover:text-hot-200"
              >
                See open times →
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 card p-6 text-center text-white/60">
          <p className="text-white">Know a court we&apos;re missing?</p>
          <p className="text-sm mt-1">Drop us a line at <a href="mailto:hello@hottiesthathit.com" className="text-hot-300">hello@hottiesthathit.com</a>.</p>
        </div>
      </section>
    </main>
  );
}
