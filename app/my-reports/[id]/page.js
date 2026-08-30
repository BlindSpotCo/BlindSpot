import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NeighbourhoodReport from '@/components/neighbourhood-report/NeighbourhoodReport';

export default async function ReportDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/my-reports/${id}`);
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select('id, folder_id, source, title, data, created_at')
    .eq('id', id)
    .eq('user_id', user.id) // RLS already enforces this, but belt and suspenders
    .single();

  if (error || !report) {
    notFound();
  }

  let folderName = null;
  if (report.folder_id) {
    const { data: folder } = await supabase
      .from('folders')
      .select('name')
      .eq('id', report.folder_id)
      .single();
    folderName = folder?.name || null;
  }

  const d = report.data || {};
  const verdict = d.summary?.solarFeasibility;
  // 'aslivastu' is the legacy source tag for reports saved before this
  // surface was renamed -- 'neighbourhood' is the only key SaveReportButton
  // writes now (see NeighbourhoodReport.js), and both are rendered by the
  // exact same component below (or on the list, the exact same detailed
  // report), so they share one label here too rather than making an old
  // saved report look like a different, unrelated thing from a new one.
  const SOURCE_LABEL = {
    sunscout: 'Home Comfort Score',
    aslivastu: 'Neighbourhood Report',
    neighbourhood: 'Neighbourhood Report',
    'ai-report': 'AI Report',
    furnishing: 'Furnishing Report',
  };

  // The neighbourhood report has its own full, detailed layout (persona
  // re-weighting, dimension readouts, price band, schools, etc.) --
  // components/neighbourhood-report/NeighbourhoodReport.js. What was
  // saved is that exact record shape, so render the real component
  // instead of re-building a stripped-down summary of it here. It's a
  // full-page layout with its own background/back control, so it's
  // returned on its own rather than nested inside .reports-page below.
  if (report.source === 'aslivastu' || report.source === 'neighbourhood') {
    return <NeighbourhoodReport record={d} />;
  }

  return (
    <div className="reports-page">
      <div className="reports-inner">
        <a href="/my-reports" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-mute)', textDecoration: 'none', fontSize: 13, marginBottom: 28 }}>
          ← Back to My Reports
        </a>

        <h1>{report.title || 'Untitled report'}</h1>
        <p className="sub">
          {SOURCE_LABEL[report.source] || report.source} · Saved {new Date(report.created_at).toLocaleDateString()}
          {folderName && <> · Folder: <strong style={{ color: 'var(--ink)' }}>{folderName}</strong></>}
        </p>

        {report.source === 'sunscout' && (
          <>
            <div style={{ display: 'flex', gap: 24, margin: '28px 0', flexWrap: 'wrap' }}>
              {d.floor && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Floor</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{d.floor}</div>
                </div>
              )}
              {d.facing && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Facing</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{d.facing}</div>
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{verdict.bestMonths.join(', ')}</div>
                  </div>
                )}
                {Array.isArray(verdict.worstMonths) && verdict.worstMonths.length > 0 && (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: '14px 18px', flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Worst Months</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{verdict.worstMonths.join(', ')}</div>
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
                        <td style={{ padding: '8px 12px 8px 0', color: 'var(--ink)' }}>{row.month || Object.values(row)[0]}</td>
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

        {report.source === 'ai-report' && (
          <>
            {d.mainHtml ? (
              <iframe
                srcDoc={d.mainHtml.replaceAll('__GALLERY_URL__', '#')}
                style={{ width: '100%', height: '85vh', border: '1px solid var(--line-soft)', borderRadius: 4 }}
                title="AI report"
              />
            ) : (
              <div className="reports-empty">This report&apos;s full content wasn&apos;t saved.</div>
            )}
          </>
        )}

        {report.source === 'furnishing' && (
          <>
            {d.confidence_note && (
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.5 }}>{d.confidence_note}</p>
            )}
            {d.dream_home_vision && (
              <div style={{ background: 'var(--sun)', color: '#fff', padding: '24px 26px', marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,.8)', marginBottom: 10 }}>Your Dream Home, Room to Room</div>
                <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{d.dream_home_vision}</p>
              </div>
            )}
            {d.whole_home_palette && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Whole-Home Palette</div>
                <p style={{ fontSize: 14, color: 'var(--text-mute)', lineHeight: 1.6 }}>{d.whole_home_palette}</p>
              </div>
            )}

            {d.imageDataUrl && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Uploaded Floor Plan</div>
                <img src={d.imageDataUrl} alt="Floor plan" style={{ maxWidth: '100%', border: '1px solid var(--line-soft)', borderRadius: 4 }} />
              </div>
            )}

            {Array.isArray(d.rooms) && d.rooms.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 14 }}>Room-by-Room Design</div>
                {d.rooms.map((room, i) => (
                  <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)', padding: '18px 20px', marginBottom: 14 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{room.name || `Room ${i + 1}`}</div>
                    {room.dimensions_note && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px' }}>{room.dimensions_note}</p>}
                    {room.vibe && <p style={{ fontSize: 13.5, color: 'var(--text-mute)', margin: '0 0 14px', lineHeight: 1.6 }}>{room.vibe}</p>}

                    {room.color_palette && (room.color_palette.walls || room.color_palette.accents || room.color_palette.textiles) && (
                      <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 3 }}>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 6 }}>Colour &amp; Material Palette</div>
                        {room.color_palette.walls && <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 2 }}><strong style={{ color: 'var(--ink)' }}>Walls:</strong> {room.color_palette.walls}</div>}
                        {room.color_palette.accents && <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 2 }}><strong style={{ color: 'var(--ink)' }}>Accents:</strong> {room.color_palette.accents}</div>}
                        {room.color_palette.textiles && <div style={{ fontSize: 12.5, color: 'var(--text-mute)' }}><strong style={{ color: 'var(--ink)' }}>Textiles:</strong> {room.color_palette.textiles}</div>}
                      </div>
                    )}

                    {Array.isArray(room.furniture) && room.furniture.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 8 }}>Furniture</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {room.furniture.map((f, j) => (
                            <div key={j} style={{ borderTop: j ? '1px dashed var(--line-soft)' : 'none', paddingTop: j ? 10 : 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{f.item}</div>
                              {f.placement && <div style={{ fontSize: 12.5, color: 'var(--text-mute)', lineHeight: 1.5 }}>{f.placement}</div>}
                              {f.size_guidance && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>Size: {f.size_guidance}</div>}
                              {f.material && <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Material: {f.material}</div>}
                              {f.note && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{f.note}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(room.lighting_plan) && room.lighting_plan.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 8 }}>Lighting</div>
                        {room.lighting_plan.map((l, j) => <p key={j} style={{ fontSize: 12.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>· {l}</p>)}
                      </div>
                    )}

                    {Array.isArray(room.textiles_and_decor) && room.textiles_and_decor.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 8 }}>Textiles &amp; Decor</div>
                        {room.textiles_and_decor.map((t, j) => <p key={j} style={{ fontSize: 12.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>· {t}</p>)}
                      </div>
                    )}

                    {room.alternative_layout && (
                      <div style={{ marginBottom: room.cautions?.length ? 14 : 0, padding: '10px 14px', border: '1px dashed var(--line)', borderRadius: 3 }}>
                        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 4 }}>Or Try Instead</div>
                        <p style={{ fontSize: 12.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>{room.alternative_layout}</p>
                      </div>
                    )}

                    {Array.isArray(room.cautions) && room.cautions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {room.cautions.map((c, j) => (
                          <div key={j} style={{ fontSize: 12, color: '#C1732E', display: 'flex', gap: 6 }}><span>⚠</span><span>{c}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(d.shopping_priority) && d.shopping_priority.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Shopping Priority</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.8 }}>
                  {d.shopping_priority.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(d.layout_notes) && d.layout_notes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>Layout Notes</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.8 }}>
                  {d.layout_notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </>
        )}


      </div>
    </div>
  );
}
