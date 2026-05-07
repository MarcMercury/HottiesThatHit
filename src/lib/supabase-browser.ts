'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SCHEMA = 'hotties';

let _client: SupabaseClient<any, any, any> | null = null;

/**
 * Browser Supabase client with persistent auth session (localStorage).
 * Singleton so React renders share the same auth state.
 */
export function getBrowserClient(): SupabaseClient<any, any, any> {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'hth-auth',
    },
    db: { schema: SCHEMA },
  });
  return _client;
}
