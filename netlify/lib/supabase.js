/**
 * Server-side Supabase client.
 *
 * Uses the SERVICE ROLE key, which bypasses row level security entirely.
 * That is correct for the sweep — it writes shared job rows on nobody's
 * behalf — but it means this module must never be imported from src/.
 * Anything under src/ ends up in the browser bundle.
 */

import { createClient } from "@supabase/supabase-js";

let client = null;

export function getServiceClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
