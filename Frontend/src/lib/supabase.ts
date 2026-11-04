import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The Phase 1 theme preview works before a backend is configured. Phase 2's
// auth provider will surface a setup error instead of making invalid requests.
export const supabase = url && anonKey && anonKey !== 'replace-with-local-anon-key'
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
