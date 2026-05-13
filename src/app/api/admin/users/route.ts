import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = getServiceClient();
  const { data: profiles, error } = await svc
    .from('profiles')
    .select(
      'id, username, email, ntrp_rating, city, is_admin, image_url_1, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with last_sign_in_at from auth.users (paginated, best-effort).
  const authById = new Map<string, { last_sign_in_at: string | null; email: string | null }>();
  try {
    const perPage = 200;
    for (let page = 1; page <= 10; page++) {
      const { data, error: authErr } = await svc.auth.admin.listUsers({ page, perPage });
      if (authErr) break;
      for (const u of data.users) {
        authById.set(u.id, {
          last_sign_in_at: u.last_sign_in_at ?? null,
          email: u.email ?? null,
        });
      }
      if (data.users.length < perPage) break;
    }
  } catch {
    // ignore — return profile data without enrichment
  }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    email: p.email ?? authById.get(p.id)?.email ?? null,
    last_sign_in_at: authById.get(p.id)?.last_sign_in_at ?? null,
  }));

  return NextResponse.json({ users });
}

export async function PATCH(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { id?: string; is_admin?: boolean; ntrp_rating?: number | null }
    | null;
  if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.is_admin === 'boolean') update.is_admin = body.is_admin;
  if (body.ntrp_rating === null || typeof body.ntrp_rating === 'number') {
    update.ntrp_rating = body.ntrp_rating;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const svc = getServiceClient();
  const { error } = await svc.from('profiles').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { action?: string; id?: string; email?: string }
    | null;
  if (body?.action !== 'reset_password') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (!body.id && !body.email) {
    return NextResponse.json({ error: 'Missing id or email' }, { status: 400 });
  }

  const svc = getServiceClient();

  let email = body.email ?? null;
  if (!email && body.id) {
    const { data, error } = await svc.auth.admin.getUserById(body.id);
    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: error?.message ?? 'User has no email' },
        { status: 400 },
      );
    }
    email = data.user.email;
  }
  if (!email) {
    return NextResponse.json({ error: 'No email on file' }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://slapp.fun';
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/auth/callback`;

  // Generates a recovery link. If SMTP is configured on the Supabase project
  // a reset email is also delivered; the action_link is returned either way so
  // the admin can send it manually if needed.
  const { data, error } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    email,
    action_link: data?.properties?.action_link ?? null,
  });
}

export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req.headers.get('authorization'));
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (id === ctx.user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  const svc = getServiceClient();
  // Deleting the auth user cascades into hotties.profiles via the FK.
  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
