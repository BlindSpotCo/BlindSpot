import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ReportDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/my-reports/${id}`);
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select('id, source, title, data, created_at')
    .eq('id', id)
    .eq('user_id', user.id) // RLS already enforces this, but belt and suspenders
    .single();

  if (error || !report) {
    notFound();
  }

  const d = report.data || {};
  const verdict = d.summary?.solarFeasibility;
  const screenshots = Array.isArray(d.screenshots) ? d.screenshots : [];

  return (
    <div className="reports-page">
      <div className="reports-inner">
        <a href="/my-reports" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-mute)', textDecoration: 'none', fontSize: 13, marginBottom: 28 }}>
          ← Back to My Reports
        </a>

        <h1>{report.title || 'Untitled report'}</h1>
        <p className="sub">
          {report.source === 'sunscout' ? 'SunScout' : 'AsliVastu'} · Saved {new Date(report.created_at).toLocaleDateString()}
        </p>

        {report.source === 'sunscout' && (
          <>
            <div style={{ display: 'flex', gap: 24, margin: '28px 0', flexWrap: 'wrap' }}>
              {d.floor && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Floor</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.floor}</div>
                </div>
              )}
              {d.facing && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Facing</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.facing}</div>
                </div>
              )}
              {(d.lat && d.lon) && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Coordinates</div>
                  <div style={{ fontSize: 14, color: 'var(--text-mute)' }}>{d.lat.toFixed(4)}, {d.lon.toFixed(4)}</div>
                </div>
              )}
            </div>

            {/* Verdict -- rendered as actual fields, not a JSON dump */}
            {verdict && (
              <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
                {verdict.verdict && (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: '14px 18px', flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Overall Verdict</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--sun)' }}>{verdict.verdict}</div>
                    {verdict.avgUsableHours != null && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{verdict.avgUsableHours}h/day avg</div>}
                  </div>
                )}
                {Array.isArray(verdict.bestMonths) && verdict.bestMonths.length > 0 && (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: '14px 18px', flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Best Months</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{verdict.bestMonths.join(', ')}</div>
                  </div>
                )}
                {Array.isArray(verdict.worstMonths) && verdict.worstMonths.length > 0 && (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: '14px 18px', flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Worst Months</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{verdict.worstMonths.join(', ')}</div>
                  </div>
                )}
              </div>
            )}

            {/* Written analysis, before the table -- matches the order the report itself uses */}
            {d.analysis && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Summary</div>
                <div style={{ fontSize: 14, color: 'var(--text-mute)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.analysis}</div>
              </div>
            )}

            {Array.isArray(d.summary?.monthlySummary) && d.summary.monthlySummary.length > 0 && (
              <div style={{ marginBottom: 32, overflowX: 'auto' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Monthly Sunlight Data</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {d.summary.monthlySummary.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td style={{ padding: '8px 12px 8px 0', color: '#fff' }}>{row.month || Object.values(row)[0]}</td>
                        <td style={{ padding: '8px 0', color: 'var(--text-mute)' }}>
                          {Object.entries(row).slice(1).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Map screenshots -- actual images, not just referenced in text */}
            {screenshots.length > 0 && (
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 12 }}>Map Screenshots ({screenshots.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {screenshots.map((shot, i) => (
                    <div key={i} style={{ border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
                      <img src={shot.base64} alt={shot.label || `Screenshot ${i + 1}`} style={{ width: '100%', display: 'block' }} />
                      {shot.label && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', padding: '6px 8px', background: 'var(--bg-2)' }}>{shot.label}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {report.source !== 'sunscout' && (
          <pre style={{ fontSize: 13, color: 'var(--text-mute)', whiteSpace: 'pre-wrap', background: 'var(--bg-2)', padding: 20, marginTop: 20 }}>
            {JSON.stringify(d, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
