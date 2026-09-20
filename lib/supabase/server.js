import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Used in Server Components, Server Actions, and Route Handlers (anything
// that runs on the server, not in the browser) to read the logged-in user's
// session from cookies.

export const isSupabaseConfigured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Without the env vars, createServerClient throws "Your project's URL and
// Key are required to create a Supabase client!" -- and on a Server
// Component that is an unhandled render error, i.e. a 500. /my-reports
// returned exactly that on a fresh clone: a blank error page where the
// honest answer is "you are not signed in".
//
// Both of the other two entry points already handle this case -- the
// browser client hands back a signed-out stub (lib/supabase/client.js)
// and proxy.js skips the session refresh -- so the server was the one
// place left that turned missing config into a broken page. Same
// contract as the browser stub: nobody is signed in, reads answer
// cleanly, and anything that genuinely needs a backend fails with a
// message naming the real problem.
const NO_SESSION = { data: { user: null, session: null }, error: null };
const notConfigured = (what) => ({
  data: { user: null, session: null },
  error: new Error(
    `Supabase isn't configured, so ${what} can't work. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`
  ),
});

// Postgres reads go through .from(...).select(...) etc. Every caller in
// this app either checks `error` or falls back to an empty list, so the
// stub answers the way an empty table would, with an error attached for
// anyone who looks.
function unconfiguredQuery() {
  const result = {
    data: null,
    error: new Error('Supabase is not configured on this deployment.'),
  };
  const chain = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    single: async () => result,
    maybeSingle: async () => result,
    // Awaiting the builder itself (no .single()) is the common shape in
    // this app -- `const { data, error } = await supabase.from(...)`.
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

function unconfiguredClient() {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[blindspot] Supabase env vars missing - server rendering as signed-out. ' +
      'Copy .env.local.example to .env.local to enable accounts locally.'
    );
  }
  return {
    auth: {
      getUser: async () => NO_SESSION,
      getSession: async () => NO_SESSION,
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: async () => notConfigured('completing sign-in'),
    },
    from: () => unconfiguredQuery(),
  };
}

export async function createClient() {
  if (!isSupabaseConfigured()) return unconfiguredClient();

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component -- safe to ignore
            // since proxy.js handles refreshing the session.
          }
        },
      },
    }
  );
}
