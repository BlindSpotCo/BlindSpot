// app/profile/page.js
//
// The signed-in person's own page: who they are, every report they've
// saved (grouped by property folder), the homes they've looked at on this
// device and the site-visit checklists they've ticked. Replaces the bare
// /my-reports list as the place saved things live (/my-reports redirects
// here; /my-reports/[id] still shows a single saved report).
import { redirect } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { createClient } from '@/lib/supabase/server';
import ProfileView from '@/components/profile/ProfileView';

export const metadata = {
  title: 'Your profile',
  robots: { index: false, follow: false },
};

// Only the small fields each card needs -- `data` itself can carry a
// whole written report (mainHtml), which the list never shows.
const LIGHT_COLUMNS = [
  'id', 'folder_id', 'source', 'title', 'created_at',
  'address:data->>address', 'kind:data->>kind',
  'combined:data->>combinedScore', 'unit:data->>unitScore',
  'floor:data->>floor', 'facing:data->>facing',
  'lat:data->>lat', 'lon:data->>lon',
  'nqi:data->>nqi_composite', 'pin:data->>pin_code', 'areaName:data->>name', 'city:data->>city',
].join(', ');

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/profile');

  let reports = [];
  let folders = [];
  let fetchFailed = false;
  try {
    let { data: reportData, error: reportErr } = await supabase
      .from('reports')
      .select(LIGHT_COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (reportErr) {
      // Older rows or an older PostgREST without JSON paths -- fall back
      // to the plain columns rather than show nothing.
      ({ data: reportData, error: reportErr } = await supabase
        .from('reports')
        .select('id, folder_id, source, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }));
    }
    const { data: folderData, error: folderErr } = await supabase
      .from('folders')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true });
    if (reportErr) throw reportErr;
    reports = reportData ?? [];
    folders = folderErr ? [] : (folderData ?? []);
  } catch {
    fetchFailed = true;
  }

  const meta = user.user_metadata || {};
  const profile = {
    id: user.id,
    email: user.email,
    name: meta.full_name || meta.name || '',
    avatar: meta.avatar_url || meta.picture || '',
    provider: user.app_metadata?.provider || 'email',
    createdAt: user.created_at,
    lastSignIn: user.last_sign_in_at,
  };

  return (
    <>
      <SiteHeader />
      <ProfileView profile={profile} initialReports={reports} folders={folders} fetchFailed={fetchFailed} />
    </>
  );
}
