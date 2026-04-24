/**
 * @fileoverview Supabase client wrappers.
 *
 * Two clients live here:
 *   - `getSupabase()`     - server-only, uses the service-role key. Used
 *                            by the poker engine + admin endpoints.
 *   - `getBrowserSupabase()` - shared anon-key client for client components.
 *
 * Important: the service role MUST NEVER be imported from a client
 * component. Throwing at construction-time when called in the browser
 * is a deliberate fence.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedServer: SupabaseClient | null = null;
let cachedBrowser: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[Astroid Lounge] getSupabase() called in the browser. ' +
        'Use getBrowserSupabase() for client components.',
    );
  }

  if (cachedServer) return cachedServer;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[Astroid Lounge] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
    );
  }

  cachedServer = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-app-name': 'astroid-lounge' } },
  });

  return cachedServer;
}

export function getBrowserSupabase(): SupabaseClient {
  if (cachedBrowser) return cachedBrowser;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[Astroid Lounge] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.',
    );
  }

  cachedBrowser = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return cachedBrowser;
}
