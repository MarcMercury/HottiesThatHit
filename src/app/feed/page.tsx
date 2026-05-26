import { PageHeader } from '@/components/PageHeader';
import { FeedClient } from './FeedClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity Feed · Hotties That Hit' };

export default function FeedPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader
        title="Activity"
        subtitle="What players you follow are up to."
      />
      <FeedClient />
    </main>
  );
}
