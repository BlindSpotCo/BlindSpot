import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Supabase redirects here after someone clicks their magic-link email.
// Exchanges the one-time code for a real session, then sends them on --
// either back to wherever they started (a SunScout/AsliVastu report they
// were trying to save), or to /my-reports by default.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 'next' may be a full external URL (e.g. back to a SunScout report) or
  // a relative path on this site -- handle both.
  const destination = next.startsWith('http') ? next : `${origin}${next}`;
  return NextResponse.redirect(destination);
}
