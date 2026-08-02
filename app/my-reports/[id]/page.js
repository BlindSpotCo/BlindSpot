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
          </>
        )}

        {report.source !== 'sunscout' && (() => {
          const LABEL = { crime:'Safety', infrastructure:'Infrastructure', air:'Air Quality', power:'Power', schools:'Schools', water:'Water Supply', roads:'Roads', sewerage:'Drainage & Sewerage' };
          const fieldRow = (label, value, unit = '') => (
            value === undefined || value === null || value === '' ? null : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderTop: '1px dashed var(--line-soft)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-dim)' }}>{label}</span>
                <span style={{ color: '#fff', fontWeight: 600, textAlign: 'right' }}>{String(value)}{unit}</span>
              </div>
            )
          );
          const section = (title, rows) => {
            const shown = rows.filter(Boolean);
            if (!shown.length) return null;
            return (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate)', marginBottom: 6, fontWeight: 700 }}>{title}</div>
                {shown}
              </div>
            );
          };

          return (
            <>
              {/* Header numbers */}
              <div style={{ display: 'flex', gap: 24, margin: '28px 0', flexWrap: 'wrap' }}>
                {d.pin_code && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>PIN</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.pin_code}</div>
                  </div>
                )}
                {d.city && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>City</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.city}</div>
                  </div>
                )}
                {d.nqi_composite != null && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>NQI Composite</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate)' }}>{d.nqi_composite}/100</div>
                  </div>
                )}
                {d.grade && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Grade</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.grade}</div>
                  </div>
                )}
                {(d.dimensions_scored != null && d.dimensions_total != null) && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Dimensions scored</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.dimensions_scored}/{d.dimensions_total}</div>
                  </div>
                )}
                {d.persona && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Persona weighting</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.persona}</div>
                  </div>
                )}
              </div>

              {/* Per-dimension scores */}
              {d.scores && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Dimension scores</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {Object.entries(d.scores).map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: '12px 16px', minWidth: 120 }}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>{LABEL[k] || k}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{v}/100</div>
                        {d.weights && d.weights[k] != null && (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{d.weights[k]}% weight</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed readings -- same fields/labels/units as the live report's spec cards */}
              {section('Crime', [
                fieldRow('Total crimes', d.total_cognizable_crimes),
                fieldRow('Safety score', d.scores?.crime, '/100'),
                fieldRow('Safer than', d.crime_percentile != null ? d.crime_percentile : null, d.crime_percentile != null ? '%' : ''),
                fieldRow('Crime tier', d.crime_tier),
              ])}

              {section('Power supply', [
                fieldRow('Discom', d.discom),
                fieldRow('Reliability', d.reliability),
                fieldRow('Avg cut hours', d.avg_outage_hours, ' /mo'),
                fieldRow('Score', d.scores?.power, '/100'),
              ])}

              {section('Connectivity & infrastructure', [
                fieldRow('Zone', d.zone_type),
                fieldRow('Metro nearby', d.metro_stations_nearby),
                fieldRow('Metro planned', d.metro_planned_stations),
                fieldRow('Highway', d.highway_proximity),
                fieldRow('Smart city', d.smart_city_project === true ? 'Yes' : d.smart_city_project === false ? 'No' : null),
                fieldRow('Infra score', d.infra_score_raw, '/100'),
              ])}

              {section('Water supply', [
                fieldRow('Daily supply', d.supply_hours, ' hrs'),
                fieldRow('Quality (TDS)', d.tds_level, d.tds_level ? ' TDS' : ''),
                fieldRow('Coverage', d.water_coverage, d.water_coverage != null ? '%' : ''),
                fieldRow('Complaints', d.complaints_per_1000, d.complaints_per_1000 != null ? '/1k' : ''),
                fieldRow('Quality score', d.water_quality, d.water_quality != null ? '/5' : ''),
              ])}

              {section('Roads', [
                fieldRow('Condition', d.road_condition),
                fieldRow('Potholes/km', d.pothole_density),
                fieldRow('Connectivity', d.connectivity),
                fieldRow('Authority', d.authority),
                fieldRow('Last resurfaced', d.last_resurfaced),
                fieldRow('Quality score', d.road_quality, d.road_quality != null ? '/5' : ''),
              ])}

              {section('Drainage & sewerage', [
                fieldRow('Sewer coverage', d.sewerage_coverage, d.sewerage_coverage != null ? '%' : ''),
                fieldRow('Treatment', d.treatment),
                fieldRow('Waterlogging risk', d.waterlogging_risk != null ? (d.waterlogging_risk >= 4 ? 'Low risk' : d.waterlogging_risk >= 3 ? 'Moderate' : 'High risk') : null),
                fieldRow('Open drains', d.open_drains === true ? 'Yes' : d.open_drains === false ? 'No' : null),
                fieldRow('Flood incidents', d.flooding_incidents_annual, d.flooding_incidents_annual != null ? '/yr' : ''),
              ])}

              {d.price_context && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate)', marginBottom: 6, fontWeight: 700 }}>Price context</div>
                  <pre style={{ fontSize: 13, color: 'var(--text-mute)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                    {typeof d.price_context === 'string' ? d.price_context : JSON.stringify(d.price_context, null, 2)}
                  </pre>
                </div>
              )}

              {Array.isArray(d.schools_list) && d.schools_list.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate)', marginBottom: 6, fontWeight: 700 }}>
                    Schools · {d.schools_count ?? d.schools_list.length} mapped
                  </div>
                  {d.schools_list.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 0', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                      <span style={{ color: '#fff' }}>{s.name}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{s.board || 'CBSE'}</span>
                    </div>
                  ))}
                </div>
              )}

              {d.url && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                  <a href={d.url} style={{ color: 'var(--slate)' }}>View live report on AsliVastu →</a>
                </p>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
