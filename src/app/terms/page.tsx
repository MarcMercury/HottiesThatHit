import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'Terms of Service · Hotties That Hit' };

export default function TermsPage() {
  return (
    <main>
      <PageHeader title="Terms of Service" subtitle="Last updated: May 7, 2026" />

      <section className="mx-auto max-w-3xl px-4 py-10 space-y-6 text-white/75 leading-relaxed">
        <Block title="Acceptance">
          <p>
            By using hottiesthathit.com you agree to these terms. If you don&apos;t agree,
            please don&apos;t use the site.
          </p>
        </Block>

        <Block title="The service">
          <p>
            Hotties That Hit aggregates publicly available tennis court availability data
            from third-party booking systems. We don&apos;t own the courts, we don&apos;t process
            bookings, and we don&apos;t guarantee that listed times are bookable at the moment
            you click them.
          </p>
        </Block>

        <Block title="No warranty">
          <p>
            The service is provided &ldquo;as is.&rdquo; Court data may be stale, incorrect, or
            incomplete. Always confirm availability with the facility before relying on it.
          </p>
        </Block>

        <Block title="Acceptable use">
          <p>
            Don&apos;t scrape our site, don&apos;t reverse-engineer our APIs, don&apos;t use the
            service to harass other users, and don&apos;t do anything illegal.
          </p>
        </Block>

        <Block title="Liability">
          <p>
            To the fullest extent permitted by law, Hotties That Hit is not liable for any
            indirect, incidental, or consequential damages arising from your use of the
            service.
          </p>
        </Block>

        <Block title="Changes">
          <p>
            We may update these terms occasionally. Continued use after changes means you
            accept the new terms.
          </p>
        </Block>

        <Block title="Contact">
          <p>
            <a href="mailto:hello@hottiesthathit.com" className="text-hot-300">hello@hottiesthathit.com</a>
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
