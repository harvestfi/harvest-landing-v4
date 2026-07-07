// Browser-only Supabase Auth client for the control room. Kept in its own
// module (imported ONLY by the control-room gate) so @supabase/supabase-js is
// code-split into the admin chunks and never ships in the public bundle - the
// public site keeps using the raw-fetch helpers in ./supabase.
//
// Its whole job: run the magic-link sign-in flow, persist + auto-refresh the
// session, and mirror the current access token into the raw-fetch read helpers
// (setSupabaseAccessToken) so control-room reads authenticate as the logged-in
// admin (RLS `authenticated`) rather than the INSERT-only publishable key.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  setSupabaseAccessToken,
} from "./supabase";

let _client: SupabaseClient | null = null;

export function authClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null; // never on the server
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Parse the magic-link callback (?code / #tokens) on load and exchange
      // it for a session automatically.
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "harvest_cr_auth",
    },
  });
  // Keep the read helpers' bearer token in lockstep with the session across
  // sign-in, token refresh and sign-out.
  _client.auth.onAuthStateChange((_event, session) => {
    setSupabaseAccessToken(session?.access_token ?? null);
  });
  return _client;
}
