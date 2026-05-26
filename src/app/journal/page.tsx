import { PageHeader } from '@/components/PageHeader';
import { JournalClient } from './JournalClient';

export const metadata = { title: 'Match Journal · Hotties That Hit' };
export const dynamic = 'force-dynamic';

export default function JournalPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Your game, recorded"
        title="Match Journal"
        subtitle="Every Open Play match shows up here once it's done. Drop in a few notes while it's still fresh."
      />
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <JournalClient />
      </section>
    </main>
  );
}
