import { getServiceClient } from '@/lib/supabase';

/**
 * Verify a Supabase access token from the `Authorization: Bearer ...` header
 * and return the authenticated user + their hotties profile (or null).
 */
export async function getUserFromAuthHeader(authHeader: string | null) {
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await svc
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  return { user: data.user, profile };
}

export async function requireAdmin(authHeader: string | null) {
  const ctx = await getUserFromAuthHeader(authHeader);
  if (!ctx?.profile?.is_admin) return null;
  return ctx;
}
