import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Saves one report (neighbourhood / ai-report / furnishing) for the signed-
// in user, optionally filing it into a folder by name -- e.g. "Flat 402" --
// so every report about the same property ends up in one place. If that
// folder name doesn't exist yet for this user it's created on the fly;
// if it does, the existing folder is reused (folders.name has a
// unique(user_id, name) constraint, so this can't create duplicates even
// if two tabs race).
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not-signed-in' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.source || !body.data) {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }
  const { source, title, data, folderName } = body;

  const ALLOWED_SOURCES = ['neighbourhood', 'ai-report', 'furnishing'];
  if (!ALLOWED_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'invalid-source' }, { status: 400 });
  }

  let folder_id = null;
  const cleanFolderName = (folderName || '').trim();
  if (cleanFolderName) {
    // Try to reuse an existing folder with this name first, rather than
    // always attempting an insert -- avoids relying on the unique-
    // constraint conflict path for the common case (same flat, later
    // report), and reads more clearly than an upsert here.
    const { data: existing } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', cleanFolderName)
      .maybeSingle();

    if (existing) {
      folder_id = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('folders')
        .insert({ user_id: user.id, name: cleanFolderName })
        .select('id')
        .single();
      if (createErr) {
        // Most likely: another tab created the same-named folder a moment
        // ago and the unique constraint just fired. Look it up rather than
        // failing the whole save over a harmless race.
        const { data: retry } = await supabase
          .from('folders')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', cleanFolderName)
          .maybeSingle();
        folder_id = retry?.id ?? null;
      } else {
        folder_id = created.id;
      }
    }
  }

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      user_id: user.id,
      folder_id,
      source,
      title: title || null,
      data,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'save-failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: report.id, folder_id });
}
