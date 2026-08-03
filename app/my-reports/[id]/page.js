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

          const card = (title, children) => (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', borderTop: '2px solid var(--slate)', padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate)', fontWeight: 700, marginBottom: 14 }}>{title}</div>
              {children}
            </div>
          );

          const stat = (label, value, unit = '') => (
            value === undefined || value === null || value === '' ? null : (
              <div>
                <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 3, lineHeight: 1.15 }}>{String(value)}{unit}</div>
              </div>
            )
          );

          const statGrid = (title, stats) => {
            const shown = stats.filter(Boolean);
            if (!shown.length) return null;
            return card(title, (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px 20px' }}>
                {shown}
              </div>
            ));
          };

          return (
            <>
              {d.url && (
                <p style={{ fontSize: 12, marginBottom: 20 }}>
                  <a href={d.url} style={{ color: 'var(--slate)' }}>View live report on AsliVastu →</a>
                </p>
              )}

              {/* Headline card */}
              {card('Overview', (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px 20px' }}>
                  {stat('PIN', d.pin_code)}
                  {stat('City', d.city)}
                  {stat('NQI Composite', d.nqi_composite, '/100')}
                  {stat('Grade', d.grade)}
                  {(d.dimensions_scored != null && d.dimensions_total != null) && stat('Dimensions scored', `${d.dimensions_scored}/${d.dimensions_total}`)}
                  {stat('Persona weighting', d.persona)}
                </div>
              ))}

              {/* Per-dimension scores */}
              {d.scores && card('Dimension scores', (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px 20px' }}>
                  {Object.entries(d.scores).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>{LABEL[k] || k}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 3 }}>{v}/100</div>
                      {d.weights && d.weights[k] != null && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{d.weights[k]}% weight</div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Detailed readings -- same fields/labels/units as the live report's spec cards */}
              {statGrid('Crime', [
                stat('Total crimes', d.total_cognizable_crimes),
                stat('Safety score', d.scores?.crime, '/100'),
                stat('Safer than', d.crime_percentile != null ? d.crime_percentile : null, d.crime_percentile != null ? '%' : ''),
                stat('Crime tier', d.crime_tier),
              ])}

              {statGrid('Power supply', [
                stat('Discom', d.discom),
                stat('Reliability', d.reliability),
                stat('Avg cut hours', d.avg_outage_hours, ' /mo'),
                stat('Score', d.scores?.power, '/100'),
              ])}

              {statGrid('Connectivity & infrastructure', [
                stat('Zone', d.zone_type),
                stat('Metro nearby', d.metro_stations_nearby),
                stat('Metro planned', d.metro_planned_stations),
                stat('Highway', d.highway_proximity),
                stat('Smart city', d.smart_city_project === true ? 'Yes' : d.smart_city_project === false ? 'No' : null),
                stat('Infra score', d.infra_score_raw, '/100'),
              ])}

              {statGrid('Water supply', [
                stat('Daily supply', d.supply_hours, ' hrs'),
                stat('Quality (TDS)', d.tds_level, d.tds_level ? ' TDS' : ''),
                stat('Coverage', d.water_coverage, d.water_coverage != null ? '%' : ''),
                stat('Complaints', d.complaints_per_1000, d.complaints_per_1000 != null ? '/1k' : ''),
                stat('Quality score', d.water_quality, d.water_quality != null ? '/5' : ''),
              ])}

              {statGrid('Roads', [
                stat('Condition', d.road_condition),
                stat('Potholes/km', d.pothole_density),
                stat('Connectivity', d.connectivity),
                stat('Authority', d.authority),
                stat('Last resurfaced', d.last_resurfaced),
                stat('Quality score', d.road_quality, d.road_quality != null ? '/5' : ''),
              ])}

              {statGrid('Drainage & sewerage', [
                stat('Sewer coverage', d.sewerage_coverage, d.sewerage_coverage != null ? '%' : ''),
                stat('Treatment', d.treatment),
                stat('Waterlogging risk', d.waterlogging_risk != null ? (d.waterlogging_risk >= 4 ? 'Low risk' : d.waterlogging_risk >= 3 ? 'Moderate' : 'High risk') : null),
                stat('Open drains', d.open_drains === true ? 'Yes' : d.open_drains === false ? 'No' : null),
                stat('Flood incidents', d.flooding_incidents_annual, d.flooding_incidents_annual != null ? '/yr' : ''),
              ])}

              {d.price_context && d.price_context.rate_sqft && card('Price context · guidance value', (() => {
                const pc = d.price_context;
                const [lo, hi] = pc.rate_sqft;
                const bands = ['Premium', 'Upper', 'Mid', 'Modest', 'Value'];
                const inr = n => '₹' + Number(n).toLocaleString('en-IN');
                const mLo = Math.round(lo * 1.2 / 100) * 100, mHi = Math.round(hi * 1.6 / 100) * 100;
                const blr = d.city === 'Bangalore';
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{inr(lo)}–{inr(hi)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>per sq ft · {(pc.label || '').toLowerCase()} band for {blr ? 'Bengaluru' : 'the NCR'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, margin: '14px 0 6px' }}>
                      {bands.map((b, i) => (
                        <div key={b} style={{ flex: 1 }}>
                          <div style={{ height: 6, background: 'var(--slate)', opacity: (i + 1) === pc.tier ? 1 : 0.25 }} />
                          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: (i + 1) === pc.tier ? 'var(--slate)' : 'var(--text-dim)', marginTop: 5, fontWeight: (i + 1) === pc.tier ? 700 : 400 }}>
                            {b}{(i + 1) === pc.tier ? ' ▲' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-mute)', margin: '12px 0 0', lineHeight: 1.5 }}>
                      Market prices run <strong style={{ color: '#fff' }}>20–70% above</strong> the {blr ? 'guidance value' : 'circle rate'} — expect roughly <strong style={{ color: '#fff' }}>{inr(mLo)}–{inr(mHi)}/sq ft</strong> in practice. Indicative government valuation, not a market quote.
                    </p>
                  </>
                );
              })())}

              {Array.isArray(d.schools_list) && d.schools_list.length > 0 && card(`Schools · ${d.schools_count ?? d.schools_list.length} mapped`, (
                <div>
                  {d.schools_list.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '9px 0', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                      <span style={{ color: '#fff' }}>{s.name}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{s.board || 'CBSE'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
}
