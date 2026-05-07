import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'Privacy Policy · Hotties That Hit' };

export default function PrivacyPage() {
  return (
    <main>
      <PageHeader title="Privacy Policy" subtitle="Last updated: May 7, 2026" />

      <section className="mx-auto max-w-3xl px-4 py-10 space-y-6 text-white/75 leading-relaxed">
        <Block title="What we collect">
          <p>
            Hotties That Hit collects minimal information needed to run the service: the email
            address you provide if you sign up for updates or matching, basic analytics about
            page visits (no cross-site tracking), and any preferences you save (favorite
            facilities, notification times).
          </p>
        </Block>

        <Block title="What we don't collect">
          <p>
            We don&apos;t sell your data. We don&apos;t embed third-party ad trackers. We don&apos;t
            require an account to browse open courts.
          </p>
        </Block>

        <Block title="Public booking data">
          <p>
            Court availability data is sourced from publicly accessible booking systems
            operated by parks departments and other facility owners. We do not store
            personal information about other users of those systems.
          </p>
        </Block>

        <Block title="Cookies">
          <p>
            We use a single first-party cookie to remember your preferences. We do not use
            third-party advertising cookies.
          </p>
        </Block>

        <Block title="Your rights">
          <p>
            You may request deletion of your email and saved preferences at any time by
            emailing <a href="mailto:privacy@hottiesthathit.com" className="text-hot-300">privacy@hottiesthathit.com</a>.
            We&apos;ll confirm deletion within 30 days.
          </p>
        </Block>

        <Block title="Children">
          <p>Hotties That Hit is not directed to children under 13.</p>
        </Block>

        <Block title="Changes">
          <p>
            We&apos;ll post any updates to this policy on this page with a new &ldquo;last updated&rdquo;
            date. Material changes will be announced by email if you&apos;re on our list.
          </p>
        </Block>

        <Block title="Contact">
          <p>
            Questions? <a href="mailto:privacy@hottiesthathit.com" className="text-hot-300">privacy@hottiesthathit.com</a>
          </p>
        </Block>
      </section>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-hot-300 mb-2">{title}</h2>
      {children}
    </div>
  );
}
