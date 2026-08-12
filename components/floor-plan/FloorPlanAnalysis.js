'use client';
// components/floor-plan/FloorPlanAnalysis.js
//
// Upload a floor plan (PDF/JPG/PNG) → Gemini Vision reads it → shows a
// marked-up copy of the plan (numbered pins per room) alongside a
// furnishing-advice card per room. Same box/kick/BPF visual language as the
// AsliVastu report, recoloured to var(--sun) — BlindSpot's existing
// unit-level accent — instead of var(--slate) (which is the AsliVastu/
// neighbourhood-level accent), so the two AI-analysis surfaces read as
// clearly different parts of the product.

import { useState, useRef } from 'react';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap');
.fp { font-family: 'Barlow', sans-serif; }
.fp .cond { font-family: 'Barlow Condensed', sans-serif; }
.fp .kick { font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; color: var(--sun); margin: 0; }
.fp-bpf { position: relative; border: 1px solid color-mix(in srgb, var(--sun) 55%, transparent); background: var(--paper); }
.fp-bpf > .m { position: absolute; color: var(--sun); font-size: 12px; line-height: 1; opacity: .55; }
.fp-bpf > .tl { top: -7px; left: -5px; } .fp-bpf > .tr { top: -7px; right: -5px; }
.fp-bpf > .bl { bottom: -8px; left: -5px; } .fp-bpf > .br { bottom: -8px; right: -5px; }
.fp-drop { border: 2px dashed color-mix(in srgb, var(--sun) 55%, transparent); cursor: pointer; transition: background .15s; }
.fp-drop:hover, .fp-drop.drag { background: color-mix(in srgb, var(--sun) 8%, transparent); }
.fp-pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: var(--sun); color: #fff; font-weight: 700; font-size: 12.5px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.35); border: 2px solid #fff; }
.fp-pin.active { outline: 3px solid color-mix(in srgb, var(--sun) 45%, transparent); }
.fp-room-card.active { border-color: var(--sun) !important; }
@media (max-width: 900px) { .fp-2col { grid-template-columns: 1fr !important; } }
`;

const STYLE_OPTIONS = ['No preference', 'Minimalist', 'Cozy & warm', 'Modern & sleek', 'Traditional', 'Eclectic / bohemian'];
const SPACE_OPTIONS = ['No preference', 'Open & airy — fewer dividers', 'Defined, cozy zones'];
const MUST_HAVE_OPTIONS = [
  'Dining table', 'Home office nook', 'Reading corner', 'Swing / jhula',
  'Bar or entertainment unit', 'Statement lighting', 'Extra storage',
  "Kids' play area", 'Plant corner', 'Meditation / yoga space',
];

function BPF({ children, style }) {
  return (
    <div className="fp-bpf" style={style}>
      <span className="m tl">+</span><span className="m tr">+</span><span className="m bl">+</span><span className="m br">+</span>
      {children}
    </div>
  );
}

function PillSelect({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)} style={{
          fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
          border: `1px solid ${value === opt ? 'var(--sun)' : 'color-mix(in srgb, var(--sun) 40%, transparent)'}`,
          background: value === opt ? 'var(--sun)' : 'transparent',
          color: value === opt ? '#fff' : 'var(--text-mute)',
        }}>{opt}</button>
      ))}
    </div>
  );
}

function MultiPillSelect({ options, values, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = values.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)} style={{
            fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${active ? 'var(--sun)' : 'color-mix(in srgb, var(--sun) 40%, transparent)'}`,
            background: active ? 'var(--sun)' : 'transparent',
            color: active ? '#fff' : 'var(--text-mute)',
          }}>{active ? '✓ ' : ''}{opt}</button>
        );
      })}
    </div>
  );
}

export default function FloorPlanAnalysis() {
  const [status, setStatus] = useState('idle'); // idle | loading | error | done
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [style, setStyle] = useState('No preference');
  const [spaceFeel, setSpaceFeel] = useState('No preference');
  const [mustHaves, setMustHaves] = useState([]);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef(null);
  const roomRefs = useRef({});

  function toggleMustHave(opt) {
    setMustHaves(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
  }

  async function handleFile(file) {
    if (!file) return;
    setStatus('loading');
    setError(null);
    setResult(null);
    setActiveRoom(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preferences', JSON.stringify({ style, spaceFeel, mustHaves, notes }));
      const res = await fetch('/api/floor-plan/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      setResult(data);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Something went wrong analysing that plan.');
      setStatus('error');
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function scrollToRoom(i) {
    setActiveRoom(i);
    roomRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return (
    <div className="fp" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 32px 64px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid color-mix(in srgb, var(--sun) 55%, transparent)' }}>
          <p className="kick" style={{ fontSize: 12 }}>Unit Intelligence · Floor Plan Furnishing Advisor</p>
          <button onClick={() => window.close()} style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid color-mix(in srgb, var(--sun) 45%, transparent)', borderRadius: 3, padding: '9px 16px', color: 'var(--text-mute)', background: 'transparent' }}>← Close</button>
        </div>

        <h1 className="cond" style={{ fontSize: 40, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase' }}>Furnish This Unit</h1>
        <p style={{ fontSize: 14, color: 'var(--text-mute)', maxWidth: 640, marginBottom: 28, lineHeight: 1.6 }}>
          Upload a floor plan — a PDF, JPG, or PNG — and get room-by-room furniture and placement suggestions, marked directly on the plan.
        </p>

        {status !== 'done' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <p className="kick" style={{ marginBottom: 14 }}>Tell Us What You Want — Everyone's Dream Home Is Different</p>
              <BPF style={{ padding: '20px 22px' }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Style</div>
                  <PillSelect options={STYLE_OPTIONS} value={style} onChange={setStyle} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Space feel</div>
                  <PillSelect options={SPACE_OPTIONS} value={spaceFeel} onChange={setSpaceFeel} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Must-haves — pick any that matter to you</div>
                  <MultiPillSelect options={MUST_HAVE_OPTIONS} values={mustHaves} onToggle={toggleMustHave} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Anything else? (optional)</div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. I work from home and need a quiet corner, I have two cats, I love natural light…"
                    style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', border: '1px solid color-mix(in srgb, var(--sun) 40%, transparent)', borderRadius: 3, resize: 'vertical', background: 'var(--bg)', color: 'var(--text)' }} />
                </div>
              </BPF>
            </div>

            <div
              className={`fp-drop ${dragOver ? 'drag' : ''}`}
              style={{ padding: '48px 24px', textAlign: 'center', marginBottom: 24 }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf" style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])} />
              {status === 'loading' ? (
                <p className="cond" style={{ fontSize: 20, fontWeight: 600, color: 'var(--sun)', margin: 0 }}>Reading your floor plan…</p>
              ) : (
                <>
                  <p className="cond" style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Drop a floor plan here, or click to choose a file</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>PDF, JPG, or PNG · up to 4MB</p>
                </>
              )}
            </div>
          </>
        )}

        {status === 'error' && (
          <BPF style={{ padding: '16px 20px', marginBottom: 24, borderColor: '#C43A2E' }}>
            <p style={{ fontSize: 13.5, color: '#C43A2E', margin: 0 }}>{error}</p>
          </BPF>
        )}

        {status === 'done' && result && (
          <>
            <div style={{ marginBottom: 20 }}>
              <button onClick={() => { setStatus('idle'); setResult(null); }} style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid color-mix(in srgb, var(--sun) 45%, transparent)', borderRadius: 3, padding: '8px 14px', color: 'var(--text-mute)', background: 'transparent' }}>↺ Analyse a different plan</button>
            </div>

            {result.confidence_note && (
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.5, maxWidth: 720 }}>{result.confidence_note}</p>
            )}

            {/* ── Dream home vision hero ── */}
            {result.dream_home_vision && (
              <div style={{ background: 'var(--sun)', color: '#fff', padding: '24px 26px', marginBottom: 20 }}>
                <p className="kick" style={{ color: 'rgba(255,255,255,.8)', marginBottom: 10 }}>Your Dream Home, Room to Room</p>
                <p className="cond" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{result.dream_home_vision}</p>
              </div>
            )}

            {result.whole_home_palette && (
              <div style={{ marginBottom: 24 }}>
                <p className="kick" style={{ marginBottom: 12 }}>Whole-Home Palette</p>
                <BPF style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: 13.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.6 }}>{result.whole_home_palette}</p>
                </BPF>
              </div>
            )}

            {result.preference_notes?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p className="kick" style={{ marginBottom: 12 }}>About Your Preferences</p>
                <BPF style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.preference_notes.map((n, i) => (
                      <p key={i} style={{ fontSize: 13, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>· {n}</p>
                    ))}
                  </div>
                </BPF>
              </div>
            )}

            {result.shopping_priority?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p className="kick" style={{ marginBottom: 12 }}>Shopping Priority — What To Get First</p>
                <BPF style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.shopping_priority.map((n, i) => (
                      <p key={i} style={{ fontSize: 13, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>{n}</p>
                    ))}
                  </div>
                </BPF>
              </div>
            )}

            <div className="fp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

              {/* ── Marked-up plan ── */}
              <div style={{ position: 'sticky', top: 24 }}>
                <p className="kick" style={{ marginBottom: 12 }}>Marked-Up Plan</p>
                <BPF style={{ padding: 6 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <img src={result.imageDataUrl} alt="Uploaded floor plan" style={{ width: '100%', display: 'block' }} />
                    {result.rooms.map((room, i) => (
                      <div key={i}
                        className={`fp-pin ${activeRoom === i ? 'active' : ''}`}
                        style={{ left: `${room.pin.x * 100}%`, top: `${room.pin.y * 100}%` }}
                        onClick={() => scrollToRoom(i)}
                        title={room.name}
                      >{i + 1}</div>
                    ))}
                  </div>
                </BPF>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>Pin positions are AI-estimated from the image, not measured — treat them as approximate room locations.</p>
              </div>

              {/* ── Room cards ── */}
              <div>
                <p className="kick" style={{ marginBottom: 12 }}>Room-by-Room Design</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {result.rooms.length === 0 && (
                    <BPF style={{ padding: 20 }}><p style={{ fontSize: 13.5, color: 'var(--text-dim)', margin: 0 }}>No rooms could be identified in this image.</p></BPF>
                  )}
                  {result.rooms.map((room, i) => (
                    <div key={i} ref={(el) => (roomRefs.current[i] = el)}>
                      <BPF className={activeRoom === i ? 'fp-room-card active' : 'fp-room-card'} style={{ padding: '20px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <span className="cond" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--sun)', color: '#fff', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                          <h3 className="cond" style={{ fontSize: 20, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>{room.name}</h3>
                        </div>
                        {room.dimensions_note && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 10px' }}>{room.dimensions_note}</p>}
                        {room.vibe && <p style={{ fontSize: 13.5, color: 'var(--text-mute)', margin: '0 0 14px', lineHeight: 1.6 }}>{room.vibe}</p>}

                        {room.color_palette && (room.color_palette.walls || room.color_palette.accents || room.color_palette.textiles) && (
                          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'color-mix(in srgb, var(--sun) 6%, transparent)', borderRadius: 3 }}>
                            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 6 }}>Colour &amp; Material Palette</div>
                            {room.color_palette.walls && <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 2 }}><strong style={{ color: 'var(--text)' }}>Walls:</strong> {room.color_palette.walls}</div>}
                            {room.color_palette.accents && <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 2 }}><strong style={{ color: 'var(--text)' }}>Accents:</strong> {room.color_palette.accents}</div>}
                            {room.color_palette.textiles && <div style={{ fontSize: 12.5, color: 'var(--text-mute)' }}><strong style={{ color: 'var(--text)' }}>Textiles:</strong> {room.color_palette.textiles}</div>}
                          </div>
                        )}

                        {room.furniture.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 8 }}>Furniture</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {room.furniture.map((f, j) => (
                                <div key={j} style={{ borderTop: j ? '1px dashed color-mix(in srgb, var(--sun) 35%, transparent)' : 'none', paddingTop: j ? 10 : 0 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.item}</div>
                                  {f.placement && <div style={{ fontSize: 12.5, color: 'var(--text-mute)', lineHeight: 1.5 }}>{f.placement}</div>}
                                  {f.size_guidance && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>Size: {f.size_guidance}</div>}
                                  {f.material && <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Material: {f.material}</div>}
                                  {f.note && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{f.note}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {room.lighting_plan?.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 8 }}>Lighting</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {room.lighting_plan.map((l, j) => (
                                <p key={j} style={{ fontSize: 12.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>· {l}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {room.textiles_and_decor?.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 8 }}>Textiles &amp; Decor</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {room.textiles_and_decor.map((t, j) => (
                                <p key={j} style={{ fontSize: 12.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>· {t}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {room.alternative_layout && (
                          <div style={{ marginBottom: room.cautions?.length ? 14 : 0, padding: '10px 14px', border: '1px dashed color-mix(in srgb, var(--sun) 45%, transparent)', borderRadius: 3 }}>
                            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: 'var(--sun)', marginBottom: 4 }}>Or Try Instead</div>
                            <p style={{ fontSize: 12.5, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>{room.alternative_layout}</p>
                          </div>
                        )}

                        {room.cautions?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {room.cautions.map((c, j) => (
                              <div key={j} style={{ fontSize: 12, color: '#C1732E', display: 'flex', gap: 6 }}>
                                <span>⚠</span><span>{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </BPF>
                    </div>
                  ))}
                </div>

                {result.layout_notes?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <p className="kick" style={{ marginBottom: 12 }}>Whole-Plan Notes</p>
                    <BPF style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.layout_notes.map((n, i) => (
                          <p key={i} style={{ fontSize: 13, color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 }}>· {n}</p>
                        ))}
                      </div>
                    </BPF>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
