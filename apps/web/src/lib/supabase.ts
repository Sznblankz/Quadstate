/**
 * Supabase client — the single seam to the backend. The app is a static SPA,
 * so the browser talks to Supabase directly with the anon/public key and Row-
 * Level Security is the access boundary (see supabase/schema.sql).
 *
 * When the env vars are absent (forks, CI, a build with no backend) the client
 * is `null` and the whole app falls back to pure guest mode — every consumer
 * null-checks `supabase` and uses the local (localStorage) path instead.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when cloud is configured. Gate accounts/sync UI on this. */
export const SUPABASE_ENABLED = Boolean(url && anon);

export const supabase: SupabaseClient | null = SUPABASE_ENABLED
  ? createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Consume the OAuth / magic-link response from the URL on load and
        // clean it up. Auth redirects carry no hash, so this never clobbers
        // the `#/p/<slug>` share route.
        detectSessionInUrl: true,
      },
    })
  : null;
