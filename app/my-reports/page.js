import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'My Reports',
  robots: { index: false, follow: false },
};

export default async function MyReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/my-reports');
  }

  let reports = [];
  let folders = [];
  let fetchFailed = false;
  try {
    const [{ data: reportData, error: reportErr }, { data: folderData, error: folderErr }] = await Promise.all([
      supabase
        .from('reports')
        .select('id, folder_id, source, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('folders')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
    ]);
    if (reportErr) throw reportErr;
    if (folderErr) throw folderErr;
    reports = reportData ?? [];
    folders = folderData ?? [];
  } catch {
    fetchFailed = true;
  }

  const SOURCE_LABEL = {
    sunscout: 'Home Comfort Score',
    aslivastu: 'Neighbourhood Score',
    neighbourhood: 'Neighbourhood Report',
    'ai-report': 'AI Report',
    furnishing: 'Furnishing Report',
  };

  const unfiled = reports.filter((r) => !r.folder_id);
  const byFolder = folders
    .map((f) => ({ ...f, reports: reports.filter((r) => r.folder_id === f.id) }))
    .filter((f) => f.reports.length > 0);

  const reportRow = (r) => (
    <a href={`/my-reports/${r.id}`} className="report-row" key={r.id} style={{ textDecoration: 'none', display: 'flex' }}>
      <span className="label">{r.title || 'Untitled report'} <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>· {SOURCE_LABEL[r.source] || r.source}</span></span>
      <span className="meta">{new Date(r.created_at).toLocaleDateString()}</span>
    </a>
  );

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  }

  return (
    <div className="reports-page">
      <div className="reports-inner">
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-mute)', textDecoration: 'none', fontSize: 13, marginBottom: 28 }}>
          ← Back to home
        </a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h1>My Reports</h1>
            <p className="sub">Signed in as {user.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--text-mute)', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 }}
            >
              Sign out
            </button>
          </form>
        </div>

        {fetchFailed && (
          <div className="reports-empty" style={{ marginBottom: 24 }}>
            Reports table isn&apos;t set up in Supabase yet — see SUPABASE_SETUP.md.
          </div>
        )}

        {!fetchFailed && reports.length === 0 && (
          <div className="reports-empty">
            Nothing saved yet. Run a Neighbourhood, AI, or Furnishing report and hit &quot;Save report&quot; to see it here — save a few into the same folder (e.g. a flat number) to keep everything about one property together.
          </div>
        )}

        {byFolder.map((f) => (
          <div className="reports-group" key={f.id}>
            <h2>{f.name}</h2>
            {f.reports.map(reportRow)}
          </div>
        ))}

        {unfiled.length > 0 && (
          <div className="reports-group av">
            <h2>{byFolder.length > 0 ? 'Unfiled' : 'All reports'}</h2>
            {unfiled.map(reportRow)}
          </div>
        )}
      </div>
    </div>
  );
}
