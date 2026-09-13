// app/api/field-feedback/route.js
//
// L5 "local-expert feedback" intake (docs/data-integrity-architecture.md,
// section 3): one endpoint every per-field "report" affordance posts to
// (see components/shared/FieldFeedback.js). Deliberately open to signed-
// out visitors -- attaches user_id when a session exists, null otherwise
// -- because the doc's whole premise is that the person who spots a wrong
// number (like the Delhi investor who found the Cantonment/metro errors)
// is rarely already a signed-in user, and gating this behind auth would
// lose most of them before they ever tell us anything.
//
// This intentionally does NOT auto-apply corrections. It files a report
// into `field_reports` (see SUPABASE_SETUP.md section 4 for the table)
// for triage -- the doc's own design: "corrections weighted by
// corroboration (n independent reports on the same field -> auto-flag ->
// L2 gate)". Auto-applying a single unverified claim would just be a new
// unverified scalar with extra steps.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_LEN = 2000;

function clamp(v) {
  if (v == null) return null;
  const s = String(v).slice(0, MAX_LEN);
  return s.trim() || null;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || !body.pin_code || !body.field_name) {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }

  const supabase = await createClient();
  // Signed-in reports carry a user_id (useful for corroboration/trust
  // weighting later); anonymous ones don't, and that's fine -- see the
  // module comment above.
  const { data: { user } } = await supabase.auth.getUser();

  const row = {
    user_id: user?.id ?? null,
    pin_code: clamp(body.pin_code),
    city: clamp(body.city),
    field_name: clamp(body.field_name),
    field_label: clamp(body.field_label),
    reported_value: clamp(body.reported_value),
    claimed_value: clamp(body.claimed_value),
    note: clamp(body.note),
    page_url: clamp(body.page_url),
    status: 'open',
  };

  if (!row.pin_code || !row.field_name) {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }

  const { error } = await supabase.from('field_reports').insert(row);
  if (error) {
    // Most likely cause on a fresh checkout: the field_reports table
    // hasn't been created yet (see SUPABASE_SETUP.md section 4). Surface
    // that plainly instead of a generic 500 -- same pattern as
    // lib/supabase/client.js's unconfiguredClient() messages.
    return NextResponse.json({ error: 'save-failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
