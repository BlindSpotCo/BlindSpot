import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Used in Server Components, Server Actions, and Route Handlers (anything
// that runs on the server, not in the browser) to read the logged-in user's
// session from cookies.
export async function createClient() {
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
            // since middleware.js below handles refreshing the session.
          }
        },
      },
    }
  );
}
