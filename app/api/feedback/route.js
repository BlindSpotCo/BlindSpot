// app/api/feedback/route.js
//
// POST /api/feedback -- the footer's "Send us feedback" box
// (components/FooterFeedback.js). Open to signed-out visitors; attaches
// user_id when there's a session.
//
// Saves to `site_feedback` (SUPABASE_SETUP.md section 7). Until that table
// exists, it files into the existing `field_reports` table instead (with
// pin_code 'site' and field_name 'site-feedback:<kind>') so nothing sent
// is lost while the table is being set up.
//
// Spam: a hidden honeypot field that people never fill, a length cap, and
// a small per-IP rate limit held in memory on the warm instance.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KINDS = new Set(['bug', 'idea', 'data', 'other']);
const MAX_MESSAGE = 3000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return list.length > MAX_PER_WINDOW;
}

const clean = (v, n) => {
  if (v == null) return null;
  const s = String(v).replace(/\u0000/g, '').trim().slice(0, n);
  return s || null;
};

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  // Honeypot: a field hidden from people. Bots fill every input. Answer
  // "ok" so they don't learn anything, and store nothing.
  if (body.website) return NextResponse.json({ ok: true });

  const message = clean(body.message, MAX_MESSAGE);
  if (!message || message.length < 3) {
    return NextResponse.json({ error: 'empty', message: 'Write a few words first.' }, { status: 400 });
  }
  const kind = KINDS.has(body.kind) ? body.kind : 'other';
  const email = clean(body.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'email', message: 'That email doesn’t look right. Fix it or leave it blank.' }, { status: 400 });
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate', message: 'That’s a lot of messages in a few minutes. Try again shortly.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const page = clean(body.page, 500);
  const ua = clean(request.headers.get('user-agent'), 300);

  const { error } = await supabase.from('site_feedback').insert({
    user_id: user?.id ?? null,
    kind, message, email: email || user?.email || null, page_url: page, user_agent: ua,
  });

  if (error) {
    // Table not created yet: keep the message in field_reports instead.
    const missingTable = /site_feedback|does not exist|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`);
    if (missingTable) {
      const { error: fallbackErr } = await supabase.from('field_reports').insert({
        user_id: user?.id ?? null,
        pin_code: 'site',
        field_name: `site-feedback:${kind}`,
        field_label: 'Footer feedback',
        note: email ? `${message}\n\nReply to: ${email}` : message,
        page_url: page,
        status: 'open',
      });
      if (!fallbackErr) return NextResponse.json({ ok: true });
      console.error('[feedback] fallback insert failed:', fallbackErr.message);
    } else {
      console.error('[feedback] insert failed:', error.message);
    }
    return NextResponse.json({ error: 'save-failed', message: 'Couldn’t send that just now. Try again in a minute.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
