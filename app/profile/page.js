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

// The same fields, from the small `summary` column (see SUPABASE_SETUP.md
// section 6). Reading `data->>x` makes Postgres load each row's whole
// report -- a sun & shadow save is a couple of megabytes of images -- just
// to pull out an address; `summary` is a few hundred bytes.
const SUMMARY_KEYS = ['address', 'kind', 'combined', 'unit', 'floor', 'facing', 'lat', 'lon', 'nqi', 'pin', 'areaName', 'city'];
const flatten = (row) => {
  const { summary, ...rest } = row;
  const out = { ...rest };
  if (summary && typeof summary === 'object') SUMMARY_KEYS.forEach((k) => { if (summary[k] != null) out[k] = summary[k]; });
  return out;
};

export default async function ProfilePage() {
  const supabase = await createClient();

  // Everything at once. Row-level security already limits both tables to
  // the signed-in user, so the queries don't have to wait for getUser().
  const [{ data: { user } }, reportRes, folderRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('reports').select('id, folder_id, source, title, created_at, summary').order('created_at', { ascending: false }),
    supabase.from('folders').select('id, name, created_at').order('name', { ascending: true }),
  ]);
  if (!user) redirect('/login?next=/profile');

  let reports = [];
  let fetchFailed = false;
  try {
    if (!reportRes.error) {
      reports = (reportRes.data ?? []).map(flatten);
      // Rows saved before `summary` existed: fetch just their fields.
      const missing = (reportRes.data ?? []).filter((r) => !r.summary).map((r) => r.id);
      if (missing.length) {
        const { data: old } = await supabase.from('reports').select(LIGHT_COLUMNS).in('id', missing);
        const byId = new Map((old ?? []).map((r) => [r.id, r]));
        reports = reports.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r));
      }
    } else {
      // No `summary` column yet -- the JSON-path read, then plain columns.
      let { data, error } = await supabase.from('reports').select(LIGHT_COLUMNS).order('created_at', { ascending: false });
      if (error) {
        ({ data, error } = await supabase.from('reports').select('id, folder_id, source, title, created_at').order('created_at', { ascending: false }));
      }
      if (error) throw error;
      reports = data ?? [];
    }
  } catch {
    fetchFailed = true;
  }
  const folders = folderRes.error ? [] : (folderRes.data ?? []);

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
