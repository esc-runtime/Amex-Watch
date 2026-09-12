/**
 * Browser-side Supabase client.
 *
 * Uses the PUBLISHABLE key, which is safe to ship in the bundle because every
 * table it touches is guarded by row level security. The service role key must
 * never appear here — anything under src/ ends up in the browser.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variable."
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
