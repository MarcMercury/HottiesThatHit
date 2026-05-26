import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getUserFromAuthHeader } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

// GET /api/facilities/[id]/notes
// Returns approved notes (public). Signed-in users also see their own pending notes.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const svc = getServiceClient();

  const { data: approved, error } = await svc
    .from('court_notes')
    .select('id, body, approved_at, created_at')
    .eq('facility_id', params.id)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let myPending: Array<{ id: string; body: string; created_at: string; status: string }> = [];
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (ctx) {
    const { data } = await svc
      .from('court_notes')
      .select('id, body, created_at, status')
      .eq('facility_id', params.id)
      .eq('author_id', ctx.user.id)
      .neq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);
    myPending = data ?? [];
  }

  return NextResponse.json({ notes: approved ?? [], my_pending: myPending });
}

// POST /api/facilities/[id]/notes  body: { body: string }
// Authenticated submission. Always stored as 'pending'; admin must approve.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!ctx.profile) {
    return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) return NextResponse.json({ error: 'Note body required' }, { status: 400 });
  if (text.length > 1000) {
    return NextResponse.json({ error: 'Note too long (max 1000)' }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data: fac } = await svc
    .from('facilities')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!fac) return NextResponse.json({ error: 'Unknown facility' }, { status: 404 });

  const { data, error } = await svc
    .from('court_notes')
    .insert({
      facility_id: params.id,
      author_id: ctx.user.id,
      body: text,
      status: 'pending',
    })
    .select('id, body, created_at, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}
