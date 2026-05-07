import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { getServiceClient } from '@/lib/supabase';

export const metadata = { title: 'Find Players · Hotties That Hit' };
export const dynamic = 'force-dynamic';

interface PlayerRow {
  username: string;
  city: string | null;
  ntrp_rating: number | null;
  image_url_1: string | null;
}

export default async function PlayersPage() {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('username, city, ntrp_rating, image_url_1')
    .order('created_at', { ascending: false })
    .limit(60);

  const players = (data ?? []) as PlayerRow[];

  return (
    <main>
      <PageHeader
        eyebrow="Players"
        title="Find Players"
        subtitle="Hitting partners on Hotties That Hit. Browse by NTRP and neighborhood."
      />

      <section className="mx-auto max-w-5xl px-4 py-10">
        {players.length === 0 ? (
          <div className="card p-8 text-center text-white/60">
            No players yet.{' '}
            <Link href="/signup" className="text-hot-300 hover:text-hot-200">
              Be the first to sign up.
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <li key={p.username}>
                <Link
                  href={`/players/${p.username}`}
                  className="card flex items-center gap-4 p-4 hover:border-hot-500/60 transition"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-ink-line bg-ink-soft">
                    {p.image_url_1 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url_1}
                        alt={p.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/40 text-xs">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">@{p.username}</p>
                    <p className="text-xs text-white/60 truncate">
                      {p.city || 'LA'} ·{' '}
                      <span className="text-hot-300">
                        NTRP {p.ntrp_rating != null ? Number(p.ntrp_rating).toFixed(1) : '—'}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
