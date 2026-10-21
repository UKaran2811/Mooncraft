/**
 * Supabase client for Cloudflare Workers.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env bindings.
 * The @supabase/supabase-js package is Workers-safe (uses fetch internally).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabase(env: Env): SupabaseClient {
  if (cachedClient) return cachedClient;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }
  cachedClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

export type { SupabaseClient };