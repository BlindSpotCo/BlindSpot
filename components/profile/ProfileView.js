'use client';
// components/profile/ProfileView.js
//
// The profile page: every saved report as a picture card (a satellite view
// of the spot, its score, the date it was saved), newest first, inside the
// folder it was saved into. Homes checked but never saved sit in a small
// strip underneath. Account details are a footer.
//
// Server-fetched: the account, folders and every saved report (light
// columns only). Read from this browser: homes looked at
// (lib/profile/history.js).

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, FileText, Sun, Sofa, MapPin, Folder, Trash2, Scale } from 'lucide-react';
import HomeMark from './HomeMark';
import MapThumb from './MapThumb';
import { createClient } from '@/lib/supabase/client';
import { readHistory, removeVisit } from '@/lib/profile/history';
import { encodeSlots } from '@/lib/compare/derive';
import './profile.css';

function typeOf(r) {
  if (r.source === 'ai-report') {
    return r.kind === 'sun-shadow'
      ? { key: 'sun', label: 'Sun & shadow', Icon: Sun }
      : { key: 'full', label: 'Full report', Icon: FileText };
  }
  if (r.source === 'neighbourhood' || r.source === 'aslivastu') return { key: 'area', label: 'Area report', Icon: MapPin };
  if (r.source === 'furnishing') return { key: 'furnish', label: 'Furnishing', Icon: Sofa };
  return { key: 'full', label: 'Home comfort', Icon: FileText };
}

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const shortAddr = (a) => String(a || '').replace(/,\s*India\s*$/i, '').split(',').map((x) => x.trim()).filter(Boolean);
const COORDS = /^\s*-?\d{1,3}\.\d+(\s*,\s*-?\d{1,3}\.\d+)?\s*$/;
function nameFor(text) {
  const first = shortAddr(text)[0] || '';
  if (!first || COORDS.test(first)) return 'A pinned spot';
  return first === first.toLowerCase() ? first.replace(/\b\w/g, (c) => c.toUpperCase()) : first;
}
const spotKey = (lat, lon) => (Number.isFinite(+lat) && Number.isFinite(+lon) && lat !== null && lon !== null ? `${(+lat).toFixed(3)},${(+lon).toFixed(3)}` : null);
const tone = (s) => (s == null ? 'none' : s >= 70 ? 'good' : s >= 50 ? 'avg' : 'poor');
const toneWord = (s) => (s == null ? '' : s >= 80 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Average' : 'Weak');

function reportHref(v) {
  const q = new URLSearchParams({ lat: String(v.lat), lon: String(v.lon) });
  if (v.pinCode) q.set('pin_code', v.pinCode);
  if (v.address) q.set('address', v.address);
  if (v.floor) q.set('floor', String(v.floor));
  if (v.facing) q.set('facing', v.facing);
  if (v.pin) q.set('pin', '1');
  return `/report?${q.toString()}`;
}

function compareHrefFor(r) {
  const lat = r.lat ?? r.pLat;
  const lon = r.lon ?? r.pLon;
  if (lat == null || lon == null) return null;
  const encoded = encodeSlots([{ name: r.address || r.name || '', lat, lon, pin: r.pin || '', floor: r.floor || '', facing: r.facing || '' }]);
  return encoded ? `/compare?c=${encoded}` : null;
}

// Saved reports, newest first, grouped by the folder they were saved into.
// Every folder shows, even an empty one; reports not in a folder come last.
function buildFolders(reports, folders, history) {
  const sorted = [...reports].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  const byFolder = new Map((folders || []).map((f) => [f.id, { id: f.id, name: f.name, items: [] }]));
  const loose = { id: 'none', name: null, items: [] };
  // A report saved without coordinates (a furnishing plan, say) borrows
  // them from another report in the same folder, for its picture.
  for (const r of sorted) (byFolder.get(r.folder_id) || loose).items.push(r);
  const decorate = (g) => {
    const spot = g.items.find((r) => r.lat && r.lon);
    g.items = g.items.map((r) => {
      const seen = r.lat && r.lon ? history.find((x) => spotKey(x.lat, x.lon) === spotKey(r.lat, r.lon)) : null;
      return {
        ...r,
        name: nameFor(r.address || r.areaName || r.title),
        score: num(r.combined) ?? num(seen?.score) ?? num(r.unit) ?? num(r.nqi),
        pLat: r.lat ?? (g.id !== 'none' ? spot?.lat : null),
        pLon: r.lon ?? (g.id !== 'none' ? spot?.lon : null),
      };
    });
    g.latest = g.items.length ? Date.parse(g.items[0].created_at) || 0 : 0;
    return g;
  };
  const out = [...byFolder.values()].map(decorate);
  out.sort((a, b) => b.latest - a.latest || a.name.localeCompare(b.name));
  if (loose.items.length) out.push(decorate(loose));
  return out;
}

const savedOn = (ts) => {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return 'Saved today';
  if (days < 2) return 'Saved yesterday';
  return `Saved ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })}`;
};

function ScoreRing({ score }) {
  if (score == null) return null;
  const C = 2 * Math.PI * 22;
  return (
    <span className={`pf-ring is-${tone(score)}`} aria-label={`Score ${score} out of 100, ${toneWord(score)}`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="22" className="pf-ring-bg" />
        <circle cx="26" cy="26" r="22" className="pf-ring-fg" strokeDasharray={`${(score / 100) * C} ${C}`} />
      </svg>
      <b>{score}</b>
    </span>
  );
}

export default function ProfileView({ profile, initialReports, folders, fetchFailed }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports || []);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [delError, setDelError] = useState('');
  const [name, setName] = useState(profile.name || '');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name || '');
  const [nameState, setNameState] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setHistory(readHistory());
      const h = window.location.hash.replace('#', '');
      if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }), 60);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const groups = useMemo(() => buildFolders(reports, folders, history), [reports, folders, history]);
  const savedSpots = useMemo(() => new Set(reports.map((r) => spotKey(r.lat, r.lon)).filter(Boolean)), [reports]);
  // A home counts as saved if a saved report is at the same spot or has
  // the same name -- a pin moved a few metres shouldn't list it twice.
  const savedNames = useMemo(() => new Set(reports.map((r) => nameFor(r.address || r.areaName || r.title).toLowerCase())), [reports]);
  const unsaved = history
    .filter((h) => !savedSpots.has(spotKey(h.lat, h.lon)) && !savedNames.has(nameFor(h.address).toLowerCase()))
    .slice(0, 8);

  const deleteReport = async (id) => {
    setDelError('');
    const prev = reports;
    setReports((list) => list.filter((r) => r.id !== id));
    setConfirmDel(null);
    try {
      const supabase = createClient();
      if (typeof supabase.from === 'function') {
        const { error } = await supabase.from('reports').delete().eq('id', id);
        if (error) throw error;
      } else {
        const res = await fetch(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
      }
    } catch {
      setReports(prev);
      setDelError('Couldn’t delete that report. Check your connection and try again.');
    }
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (next === name) { setEditingName(false); return; }
    setNameState('saving');
    const { error } = await createClient().auth.updateUser({ data: { full_name: next } });
    if (error) { setNameState('error'); return; }
    setName(next); setNameState(''); setEditingName(false);
    router.refresh();
  };

  const signOut = async () => {
    setSigningOut(true);
    try { await createClient().auth.signOut(); } catch {}
    window.location.href = '/';
  };

  const displayName = name || (profile.email || '').split('@')[0];
  const firstName = displayName.split(' ')[0];

  return (
    <main className="pf">
      <div className="pf-wrap">
        <div className="pf-head">
          <HomeMark seed={profile.id || profile.email} size={48} className="pf-mark" title="Your BlindSpot mark" />
          <h1 className="pf-hello">
            {reports.length > 0 ? `${firstName}'s reports` : `Hi ${firstName}`}
          </h1>
          {reports.length > 0 && (
            <Link href="/#find" className="pf-new"><Plus size={18} strokeWidth={2.4} aria-hidden="true" /><span>New report</span></Link>
          )}
        </div>

        {/* ---------------- saved reports, by folder ---------------- */}
        <section id="saved" className="pf-homes-sec" aria-label="Your saved reports">
          {fetchFailed && <p className="pf-msg is-bad">Your saved reports didn&rsquo;t load. Refresh the page; if it keeps happening, sign out and back in.</p>}
          {delError && <p className="pf-msg is-bad" role="alert">{delError}</p>}

          {!fetchFailed && reports.length === 0 && (
            <div className="pf-empty">
              <div className="pf-empty-art" aria-hidden="true"><Plus size={28} strokeWidth={2} /></div>
              <h2>Save your first report</h2>
              <p>Look up a flat, set its floor and facing, generate a report and press <strong>Save report</strong>. Put a home&rsquo;s reports in one folder, like &ldquo;Flat 402&rdquo;, to keep them together.</p>
              <Link href="/#find" className="pf-new is-big">Look up a flat</Link>
            </div>
          )}

          {reports.length > 0 && (
            <>
              <div className="pf-bar">
                <p>{reports.length} {reports.length === 1 ? 'report' : 'reports'}{(folders || []).length ? ` in ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}` : ''}, newest first</p>
                <button type="button" className="pf-edit" onClick={() => { setEditing((v) => !v); setConfirmDel(null); }} aria-pressed={editing}>
                  {editing ? 'Done' : 'Edit'}
                </button>
              </div>
              {groups.map((g) => (
                <section key={g.id} className="pf-folder" aria-label={g.name || 'Not in a folder'}>
                  <h2 className="pf-folder-h">
                    {g.name ? <Folder size={18} strokeWidth={2.2} aria-hidden="true" /> : null}
                    <span>{g.name || 'Not in a folder'}</span>
                    <small>{g.items.length} {g.items.length === 1 ? 'report' : 'reports'}</small>
                  </h2>
                  {g.items.length === 0 ? (
                    <p className="pf-folder-empty">Empty. Choose this folder when you save a report.</p>
                  ) : (
                    <ul className="pf-cards">
                      {g.items.map((r) => {
                        const t = typeOf(r);
                        const confirming = editing && confirmDel === r.id;
                        return (
                          <li key={r.id} className={`pf-card${editing ? ' is-editing' : ''}`}>
                            <Link href={`/my-reports/${r.id}`} className="pf-card-hit" aria-label={`Open ${t.label} for ${r.name}`} tabIndex={editing ? -1 : undefined}>
                              <MapThumb lat={r.pLat} lon={r.pLon} />
                              <span className="pf-card-shade" />
                              <ScoreRing score={r.score} />
                              <span className={`pf-type is-${t.key}`}><t.Icon size={13} strokeWidth={2.4} aria-hidden="true" />{t.label}</span>
                            </Link>
                            <div className="pf-card-body">
                              <h3 className="pf-card-name"><Link href={`/my-reports/${r.id}`}>{r.name}</Link></h3>
                              <p className="pf-card-detail">
                                {[r.floor && `Floor ${r.floor}`, r.facing && `${r.facing}-facing`].filter(Boolean).join(', ')}
                              </p>
                              <p className="pf-card-date">{savedOn(r.created_at)}</p>
                              {!editing && compareHrefFor(r) && (
                                <Link href={compareHrefFor(r)} className="pf-compare">
                                  <Scale size={13} strokeWidth={2.2} aria-hidden="true" /> Compare
                                </Link>
                              )}
                              {editing && (
                                confirming ? (
                                  <span className="pf-del is-confirm">
                                    Delete?
                                    <button type="button" onClick={() => deleteReport(r.id)} className="pf-del-yes">Yes</button>
                                    <button type="button" onClick={() => setConfirmDel(null)} className="pf-del-no">No</button>
                                  </span>
                                ) : (
                                  <button type="button" className="pf-del" onClick={() => setConfirmDel(r.id)}>
                                    <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" /> Delete
                                  </button>
                                )
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
        </section>

        {/* ---------------- looked at, not saved ---------------- */}
        {unsaved.length > 0 && (
          <section id="recent" className="pf-recent" aria-labelledby="pf-recent-h">
            <h2 id="pf-recent-h">Looked at, not saved</h2>
            <ul className="pf-strip">
              {unsaved.map((h) => (
                <li key={`${h.lat},${h.lon}`} className="pf-mini">
                  <Link href={reportHref(h)} className="pf-mini-hit">
                    <MapThumb lat={h.lat} lon={h.lon} className="is-mini" />
                    <span className="pf-mini-text">
                      <strong>{nameFor(h.address)}</strong>
                      {num(h.score) != null && <span className={`pf-mini-score is-${tone(num(h.score))}`}>{num(h.score)}</span>}
                    </span>
                  </Link>
                  <button type="button" className="pf-mini-x" onClick={() => { removeVisit(h.lat, h.lon); setHistory(readHistory()); }} aria-label={`Remove ${nameFor(h.address)}`}><X size={14} strokeWidth={2.4} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------------- account ---------------- */}
        <footer id="account" className="pf-foot">
          {editingName ? (
            <form className="pf-name-edit" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} autoFocus />
              <button type="submit" disabled={nameState === 'saving'}>{nameState === 'saving' ? 'Saving…' : 'Save'}</button>
              <button type="button" className="is-quiet" onClick={() => { setEditingName(false); setNameDraft(name); setNameState(''); }}>Cancel</button>
            </form>
          ) : (
            <p className="pf-foot-who">
              Signed in as <strong>{profile.email}</strong>{profile.provider === 'google' ? ' with Google' : ''}
            </p>
          )}
          {nameState === 'error' && <p className="pf-msg is-bad">Couldn&rsquo;t save your name. Try again.</p>}
          <div className="pf-foot-actions">
            {!editingName && <button type="button" onClick={() => { setNameDraft(name); setEditingName(true); }}>{name ? 'Change name' : 'Add your name'}</button>}
            <button type="button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
          <p className="pf-credit">Satellite imagery: Esri</p>
        </footer>
      </div>
    </main>
  );
}
