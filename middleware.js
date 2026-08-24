import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// This was missing -- lib/supabase/server.js has a comment claiming
// "middleware.js below handles refreshing the session," but that file
// never existed. Without it, the session cookie Supabase sets on login
// never gets refreshed/re-synced on subsequent requests, which is why
// the header kept showing "Sign in" after a successful login, and why
// POST /api/reports was rejecting people as not-signed-in even right
// after they signed in -- the server-side cookie read in
// lib/supabase/server.js was seeing a stale or missing session.
//
// This is the standard Supabase + Next.js App Router pattern: run on
// every request, call getUser() (which internally refreshes the token
// if needed), and make sure any refreshed cookies get forwarded on both
// the incoming request and the outgoing response.
export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Just calling getUser() is enough -- it's what triggers Supabase's
  // internal token-refresh-if-needed logic and writes any updated
  // cookies back out via setAll above.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on everything except static assets and images -- no point
    // touching auth cookies for a favicon or a CSS file.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
