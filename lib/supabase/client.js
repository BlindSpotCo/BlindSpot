import { createBrowserClient } from '@supabase/ssr';

// A single shared client instance for the whole tab, instead of a fresh
// one every time createClient() is called. This matters for cross-
// component sign-in sync: SiteHeader and SaveReportButton (and anything
// else) each used to get their own independent client, so calling
// setSession() from one never updated the others' in-memory state or
// fired their onAuthStateChange listeners -- they'd stay showing
// "signed out" until a full page reload. With one shared instance,
// setSession() anywhere notifies every listener in the tab immediately.
let browserClient;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return browserClient;
}
