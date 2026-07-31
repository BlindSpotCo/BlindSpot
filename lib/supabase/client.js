import { createBrowserClient } from '@supabase/ssr';

// Used in any 'use client' component that needs to check the logged-in
// user or query Supabase directly from the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
