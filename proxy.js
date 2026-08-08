import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Runs on every request. Its only job is to refresh the Supabase auth
// session cookie so a logged-in user doesn't get silently signed out.
// Named "proxy" (not "middleware") -- required by Next.js 16, which
// renamed this file convention and now runs it on the Node.js runtime
// by default instead of Edge.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  // Without the Supabase env vars, createServerClient throws -- and because
  // this runs on EVERY request, that one throw takes down every route on
  // the site, including pages that have nothing to do with auth (a local
  // dev server with no .env.local returns 404 for the whole site, which
  // reads as "the page doesn't exist" rather than "config is missing").
  // Session refresh is the only thing happening here, so when the config
  // isn't present, skip it and serve the request normally instead.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[proxy] Supabase env vars missing -- skipping auth session refresh. ' +
        'Copy .env.local.example to .env.local and fill it in to enable login locally.'
      );
    }
    return response;
  }

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually triggers the refresh if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
