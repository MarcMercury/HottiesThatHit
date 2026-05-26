import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase';
import { PlayerSocial } from './PlayerSocial';

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
    .select('id, username, city, bio, ntrp_rating, image_url_1, image_url_2, image_url_3')
    .eq('username', params.username.toLowerCase())
    .maybeSingle();

  if (!data) notFound();

  const images = [data.image_url_1, data.image_url_2, data.image_url_3].filter(
    (u): u is string => !!u,
  );

  // Public favorite courts for this player. Limited to a sane page size.
  const { data: favRows } = await supabase
    .from('favorites')
    .select(
      'facility_id, created_at, facilities ( id, name, city, region, num_courts, online_booking, facility_booking_url )',
    )
    .eq('user_id', data.id)
    .order('created_at', { ascending: false })
    .limit(24);
  const favorites = ((favRows ?? []) as unknown as Array<{
    facility_id: string;
    facilities: {
      id: string;
      name: string;
      city: string | null;
      region: string | null;
      num_courts: number | null;
      online_booking: boolean | null;
      facility_booking_url: string | null;
    } | null;
  }>).filter((r) => r.facilities);

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

      <PlayerSocial username={data.username} />

      {favorites.length > 0 && (
        <section className="card mt-6 p-6">
          <h2 className="text-white font-semibold">Favorite courts</h2>
          <p className="text-white/50 text-xs mt-1">
            {favorites.length} {favorites.length === 1 ? 'court' : 'courts'} saved by @{data.username}.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {favorites.map((row) => {
              const f = row.facilities!;
              const meta = [
                f.num_courts ? `${f.num_courts} courts` : null,
                f.city,
                f.region,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li
                  key={row.facility_id}
                  className="rounded-xl border border-ink-line bg-ink-soft/60 p-4"
                >
                  <p className="text-white font-semibold">{f.name}</p>
                  {meta && <p className="text-white/50 text-xs mt-1">{meta}</p>}
                  {f.online_booking && f.facility_booking_url && (
                    <a
                      href={f.facility_booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-hot-300 hover:text-hot-200"
                    >
                      Book ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
