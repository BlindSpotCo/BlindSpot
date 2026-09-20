import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Supabase redirects here after a Google sign-in, a magic-link-style
// email click, an email confirmation, or a password-reset link. Exchanges
// the one-time code for a real session, then sends the person on --
// either back to wherever they started, or to the homepage by default.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') || '/';

  // Supabase sends the reason here when the link itself is the problem --
  // an expired or already-used reset link, a cancelled consent screen.
  // This used to be ignored entirely: the person was redirected to the
  // homepage as though it had worked, and only found out it hadn't when
  // the next signed-in thing they tried said they were signed out.
  const authError = searchParams.get('error_description') || searchParams.get('error');
  if (authError) {
    const back = new URL('/login', origin);
    back.searchParams.set('error', authError);
    return NextResponse.redirect(back.toString());
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Same failure, one step later: a code that cannot be exchanged (already
    // spent, wrong project, clock skew) left no session behind, so carrying
    // on to `next` silently landed a signed-out person on a signed-in page.
    if (error) {
      const back = new URL('/login', origin);
      back.searchParams.set('error', error.message || 'sign-in-failed');
      return NextResponse.redirect(back.toString());
    }
  }

  const isExternal = /^https?:\/\//i.test(rawNext);

  if (isExternal) {
    // Session is already set via this domain's cookies at this point.
    // Hand off to a small client page (same domain) that reads it and
    // does the final jump to the external site itself, in JavaScript --
    // a server redirect's Location header can have its URL fragment
    // silently stripped by edge/CDN layers, but a client-side
    // window.location.href assignment never loses it. That page checks
    // `next` against its own origin allowlist before handing over any
    // tokens; this route does not need to repeat the check, but it does
    // need to not forward anything that ISN'T one of those two shapes --
    // see below.
    const handoff = new URL('/auth/external-redirect', origin);
    handoff.searchParams.set('next', rawNext);
    return NextResponse.redirect(handoff.toString());
  }

  // Everything else is treated as a path on this site, and has to actually
  // BE one. "//evil.com" and "/\evil.com" both look like paths to a
  // startsWith('/') check and are both read as "https://evil.com" by
  // browsers once they land in a Location header -- the standard open-
  // redirect bypass. Resolving against our own origin and then confirming
  // the result is still our own origin rejects both without having to
  // enumerate the tricks.
  const target = new URL(rawNext, origin);
  const next = target.origin === origin ? target.pathname + target.search + target.hash : '/';

  return NextResponse.redirect(`${origin}${next}`);
}
