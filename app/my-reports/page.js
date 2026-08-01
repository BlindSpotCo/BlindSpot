import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MyReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/my-reports');
  }

  // Empty until the "Save to BlindSpot" buttons on SunScout and AsliVastu
  // are wired up (next phase) -- this table doesn't exist yet either; see
  // SUPABASE_SETUP.md for the SQL to create it.
  let reports = [];
  let fetchFailed = false;
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id, source, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    reports = data ?? [];
  } catch {
    fetchFailed = true;
  }

  const sunscoutReports = reports.filter((r) => r.source === 'sunscout');
  const aslivastuReports = reports.filter((r) => r.source === 'aslivastu');

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
            Nothing saved yet. Run a report on SunScout or AsliVastu and hit &quot;Save to BlindSpot&quot; to see it here.
          </div>
        )}

        {sunscoutReports.length > 0 && (
          <div className="reports-group">
            <h2>SunScout</h2>
            {sunscoutReports.map((r) => (
              <a href={`/my-reports/${r.id}`} className="report-row" key={r.id} style={{ textDecoration: 'none', display: 'flex' }}>
                <span className="label">{r.title || 'Untitled report'}</span>
                <span className="meta">{new Date(r.created_at).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        )}

        {aslivastuReports.length > 0 && (
          <div className="reports-group">
            <h2>AsliVastu</h2>
            {aslivastuReports.map((r) => (
              <a href={`/my-reports/${r.id}`} className="report-row" key={r.id} style={{ textDecoration: 'none', display: 'flex' }}>
                <span className="label">{r.title || 'Untitled report'}</span>
                <span className="meta">{new Date(r.created_at).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
