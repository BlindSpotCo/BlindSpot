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

export const isSupabaseConfigured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// What createClient() hands back when the Supabase keys aren't set.
//
// A fresh clone has no .env.local -- it is gitignored, and it should be --
// so the first `npm run dev` after cloning had SiteHeader throw on mount
// and take every page down with it, including the ones with nothing to do
// with accounts. proxy.ts already degrades gracefully in exactly this case
// ("skipping auth session refresh"); the browser client did not, so the
// server said "carry on without auth" while the client crashed the render.
//
// This makes the client agree with the server: no keys means nobody is
// signed in. Reads answer as signed-out, listeners never fire, and the
// operations that genuinely cannot work without a backend fail with a
// message naming the real problem instead of the library's generic one.
const NO_SESSION = { data: { user: null, session: null }, error: null };
const notConfigured = (what) => ({
  data: { user: null, session: null },
  error: new Error(
    `Supabase isn't configured, so ${what} can't work. Copy .env.local.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`
  ),
});

function unconfiguredClient() {
  let warned = false;
  const warn = () => {
    if (warned || typeof console === 'undefined') return;
    warned = true;
    console.info(
      '[blindspot] Supabase env vars missing - running signed-out. ' +
      'Copy .env.local.example to .env.local to enable accounts locally.'
    );
  };
  return {
    auth: {
      getUser:    async () => { warn(); return NO_SESSION; },
      getSession: async () => { warn(); return NO_SESSION; },
      // Nothing will ever change, so the listener is never called -- but it
      // still has to hand back an unsubscribe, because every caller calls it
      // on unmount.
      onAuthStateChange: () => { warn(); return { data: { subscription: { unsubscribe() {} } } }; },
      signOut:    async () => { warn(); return { error: null }; },
      setSession:            async () => { warn(); return notConfigured('signing in'); },
      signInWithPassword:    async () => { warn(); return notConfigured('signing in'); },
      signInWithOAuth:       async () => { warn(); return notConfigured('signing in'); },
      signUp:                async () => { warn(); return notConfigured('creating an account'); },
      resetPasswordForEmail: async () => { warn(); return notConfigured('password reset'); },
      updateUser:            async () => { warn(); return notConfigured('updating your account'); },
      exchangeCodeForSession:async () => { warn(); return notConfigured('completing sign-in'); },
    },
  };
}

export function createClient() {
  if (!browserClient) {
    browserClient = isSupabaseConfigured()
      ? createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
      : unconfiguredClient();
  }
  return browserClient;
}
