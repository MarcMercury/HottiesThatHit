import { NextRequest, NextResponse } from 'next/server';
import { PLAYERS, type TennisPlayer } from '@/lib/tennisPlayers';

export const runtime = 'nodejs';

// Deterministic "vibe" pick based on a hash of the seed (selfie filename + size)
// so the same selfie always returns the same player — feels like real analysis.
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function POST(req: NextRequest) {
  let seed = '';
  let tourFilter: 'ATP' | 'WTA' | 'ANY' = 'ANY';

  const ctype = req.headers.get('content-type') || '';
  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('selfie');
    const tour = (form.get('tour') as string | null) || 'ANY';
    if (tour === 'ATP' || tour === 'WTA') tourFilter = tour;
    if (file instanceof File) {
      seed = `${file.name}|${file.size}|${file.type}`;
    } else {
      seed = String(Date.now());
    }
  } else {
    seed = String(Date.now());
  }

  const pool: TennisPlayer[] =
    tourFilter === 'ANY' ? PLAYERS : PLAYERS.filter((p) => p.tour === tourFilter);
  const h = hashString(seed);
  const player = pool[h % pool.length];
  const similarity = 70 + (h % 30); // 70 – 99

  return NextResponse.json({
    ...player,
    similarity,
    seed,
  });
}
