import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Supabase redirects here after a Google sign-in, a magic-link-style
// email click, an email confirmation, or a password-reset link. Exchanges
// the one-time code for a real session, then sends the person on --
// either back to wherever they started, or to the homepage by default.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const isExternal = next.startsWith('http');

  if (isExternal) {
    // Session is already set via this domain's cookies at this point.
    // Hand off to a small client page (same domain) that reads it and
    // does the final jump to the external site itself, in JavaScript --
    // a server redirect's Location header can have its URL fragment
    // silently stripped by edge/CDN layers, but a client-side
    // window.location.href assignment never loses it.
    const handoff = new URL('/auth/external-redirect', origin);
    handoff.searchParams.set('next', next);
    return NextResponse.redirect(handoff.toString());
  }

  return NextResponse.redirect(`${origin}${next}`);
}
