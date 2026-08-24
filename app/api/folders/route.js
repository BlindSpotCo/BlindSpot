import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Lists the signed-in user's folders (e.g. "Flat 402", "Whitefield House")
// so the Save-report panel can offer them alongside a "new folder" field.
// Folders themselves are created lazily by POST /api/reports the first
// time someone saves into a name that doesn't exist yet -- there's no
// separate "create empty folder" flow.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not-signed-in' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('folders')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) {
    // Most likely cause: the folders table hasn't been created yet in this
    // Supabase project (see SUPABASE_SETUP.md). Report it as an empty list
    // rather than a hard failure, so the Save panel still lets someone type
    // a brand-new folder name.
    return NextResponse.json({ folders: [], setupIncomplete: true });
  }

  return NextResponse.json({ folders: data ?? [] });
}
