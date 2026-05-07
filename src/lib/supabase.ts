import { createClient } from '@supabase/supabase-js';

// Hotties That Hit shares a Supabase project with Trauma Box.
// All Hotties tables live in the `hotties` schema (set via SUPABASE_DB_SCHEMA),
// so Trauma Box's `public` schema is never touched by this app.
const SCHEMA = process.env.SUPABASE_DB_SCHEMA ?? 'hotties';

// Server-side client. Service role bypasses RLS — only call from API routes / scrapers.
export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });
}

// Browser-safe client (anon key) for the UI.
export function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, key, {
    db: { schema: SCHEMA },
  });
}
