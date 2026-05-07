import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'Find Players · Hotties That Hit' };

export default function PlayersPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Coming soon"
        title="Find Players"
        subtitle="Match with hitting partners by NTRP rating, schedule, and neighborhood. We're building it now — get on the list."
      />

      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="card p-6 md:p-8">
          <h2 className="font-display text-2xl text-white">Get early access</h2>
          <p className="mt-2 text-white/65 text-sm">
            We&apos;ll ping you the second matching goes live. No spam, no algorithms,
            just hitting partners who actually show up.
          </p>

          <form
            action="https://formspree.io/f/placeholder"
            method="POST"
            className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="you@email.com"
              className="rounded-full border border-ink-line bg-ink px-4 py-2.5 text-sm
                         text-white placeholder:text-white/40 focus:outline-none
                         focus:border-hot-500 focus:ring-2 focus:ring-hot-500/30"
            />
            <button type="submit" className="btn-primary">Notify me</button>
          </form>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 text-sm">
            <Feature title="NTRP-aware" desc="2.5 to 5.5+. We respect rating gaps." />
            <Feature title="Neighborhood-first" desc="Westside, Valley, Eastside — your courts." />
            <Feature title="Reliable only" desc="No-shows lose access. Period." />
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/60 p-4">
      <p className="text-hot-300 font-semibold">{title}</p>
      <p className="text-white/60 text-xs mt-1">{desc}</p>
    </div>
  );
}
