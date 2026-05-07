import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase';

interface Props {
  params: { username: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  return { title: `@${params.username} · Hotties That Hit` };
}

export default async function PlayerProfilePage({ params }: Props) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('username, city, bio, ntrp_rating, image_url_1, image_url_2, image_url_3')
    .eq('username', params.username.toLowerCase())
    .maybeSingle();

  if (!data) notFound();

  const images = [data.image_url_1, data.image_url_2, data.image_url_3].filter(
    (u): u is string => !!u,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/players" className="text-xs text-white/50 hover:text-white/80">
        ← All players
      </Link>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <h1 className="font-display text-4xl text-white">@{data.username}</h1>
        <span className="chip">
          NTRP {data.ntrp_rating != null ? Number(data.ntrp_rating).toFixed(1) : '—'}
        </span>
        {data.city && <span className="text-white/60 text-sm">{data.city}</span>}
      </div>

      {images.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {images.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={u}
              src={u}
              alt={data.username}
              className="aspect-square w-full rounded-xl border border-ink-line object-cover"
            />
          ))}
        </div>
      )}

      {data.bio && (
        <section className="card mt-6 p-6">
          <p className="text-white/80 whitespace-pre-wrap text-sm">{data.bio}</p>
        </section>
      )}
    </main>
  );
}
