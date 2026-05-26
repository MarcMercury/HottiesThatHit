import { PageHeader } from '@/components/PageHeader';
import { AvailabilityClient } from './AvailabilityClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'I\'m Free · Hotties That Hit' };

export default function AvailabilityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <PageHeader
        title="I'm free to play"
        subtitle="Drop a ping so friends know when and where to find you."
      />
      <AvailabilityClient />
    </main>
  );
}
